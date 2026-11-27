import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { queuedJobSchema } from './schemas.js';

type Submit = (siteId: string, input: Record<string, unknown>, write: boolean, requestId?: string) => Promise<CallToolResult>;
type AuthMetadata = { securitySchemes: { type: string; scopes: string[] }[] };
const queuedRead = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const sensitiveWrite = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
const externalSensitiveWrite = { ...sensitiveWrite, openWorldHint: true };
const contentType = z.enum(['post', 'page']);
const revision = z.string().min(10).max(40).describe('Exact modified_gmt returned by the latest content read.');
const httpsUrl = z.string().url().max(4000).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch { return false; }
}, 'A credential-free HTTPS URL without a fragment is required.');
const httpsOrEmpty = z.union([z.string().url().max(2048).refine(value => httpsUrl.safeParse(value).success, 'A credential-free HTTPS SEO URL is required.'), z.literal('')]);
const approved = z.literal(true).describe('True only after the user approves this exact operation and its effects.');
const requestId = z.string().uuid().describe('Stable idempotency UUID. Reuse this UUID for retries of the same approved operation.');
const slug = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,99}(?![\s\S])/);
const stylesheet = z.string().regex(/^[a-zA-Z0-9_-]{1,100}(?![\s\S])/);
const pluginFile = z.string().regex(/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?[.]php$/).max(190)
  .refine(value => !value.includes('..') && !/[\r\n]/.test(value), 'Use the exact installed plugin file, without traversal.');
const seoFields = z.object({
  title: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  canonical: httpsOrEmpty.optional(),
  robots_noindex: z.boolean().optional(),
  robots_nofollow: z.boolean().optional(),
  og_title: z.string().max(300).optional(),
  og_description: z.string().max(2000).optional(),
  og_image: httpsOrEmpty.optional(),
  twitter_title: z.string().max(300).optional(),
  twitter_description: z.string().max(2000).optional(),
  twitter_image: httpsOrEmpty.optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'Provide at least one supported SEO field.');

/** Every callable operation has an explicit reviewable schema; no generic executor. */
export function registerDedicatedOperations(server: McpServer, submit: Submit, auth: {
  oauthContentRead: AuthMetadata; oauthContentWrite: AuthMetadata;
}) {
  const builder = z.enum(['elementor','gutenberg']);
  const nodeId = z.string().regex(/^[A-Za-z0-9_.-]{1,120}(?![\s\S])/);
  const builderField = z.enum(['title','editor','html','text','inner_html']);
  const controlKey = z.string().regex(/^[a-z][a-z0-9_]{0,79}(?![\s\S])/);
  const builderRevision = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
  const builderControlValue = z.union([
    z.string().min(1).max(2048),
    z.object({size:z.number().min(0).max(2000),unit:z.enum(['px','em','rem','%','vw','vh'])}).strict(),
    z.object({id:z.number().int().positive()}).strict(),
    z.object({url:z.string().url().max(2048),is_external:z.boolean().optional(),nofollow:z.boolean().optional()}).strict(),
  ]);
  const builderIdentity = {site_id:z.string().uuid(),content_type:contentType,item_id:z.number().int().positive()};
  const builderApproval = {expected_revision:builderRevision,expected_modified_gmt:revision,user_confirmed:approved,request_id:requestId};
  const builderMeta=(write:boolean,label:string)=>({... (write ? auth.oauthContentWrite : auth.oauthContentRead),
    'openai/toolInvocation/invoking':'WordRava: '+label+'…','openai/toolInvocation/invoked':'WordRava: Request submitted'});
  const invalidBuilderInput=()=>({isError:true as const,content:[{type:'text' as const,text:'Invalid builder arguments. Use a fresh native builder read and the exact supported operation.'}]});
  // Explicit native operations. The connector must also validate the installed
  // theme/plugin, native capabilities, unified local permission profile and revisions.
  const compatTheme = z.string().max(200).regex(/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?(?![\s\S])/)
    .refine(value => !value.includes('..'), 'Use the exact active stylesheet identifier.');
  const compatSlug = z.string().regex(/^[A-Za-z0-9_-]{1,100}(?![\s\S])/);
  const compatRevision = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
  const compatApproval = { expected_revision: compatRevision, user_confirmed: approved, request_id: requestId };
  const siteIdentity = { site_id: z.string().uuid() };
  const themeIdentity = { ...siteIdentity, stylesheet: compatTheme };
  const partIdentity = { ...themeIdentity, slug: compatSlug };
  const compatPoly = { ...siteIdentity, content_type: contentType, item_id: z.number().int().positive() };
  const boundedCss = z.string().max(45000).refine(value => Buffer.byteLength(value,'utf8') <= 45000 &&
    !/<\/style/i.test(value) && !/<(?:\/(?:s(?:t(?:y(?:l(?:e)?)?)?)?)?)?$/i.test(value), 'Invalid or oversized CSS.');
  const boundedMarkup = z.string().min(1).max(45000).refine(value => Buffer.byteLength(value,'utf8') <= 45000 &&
    value.trim().length > 0 && !value.includes('<?'), 'Use bounded native block markup, not PHP.');
  const appearanceRead = (label:string) => ({ outputSchema:queuedJobSchema, annotations:queuedRead, _meta:builderMeta(false,label) });
  const appearanceWrite = (label:string) => ({ outputSchema:queuedJobSchema, annotations:sensitiveWrite, _meta:builderMeta(true,label) });
  const compatibilityRead = (site_id:string,kind:string,payload:object={},content_type='post',item_id?:number) =>
    submit(site_id,{kind,contentType:content_type,...(item_id===undefined?{}:{itemId:item_id}),content:JSON.stringify(payload)},false);
  const compatibilityWrite = (site_id:string,kind:string,payload:object,user_confirmed:true,request_id:string,content_type='post',item_id?:number) =>
    submit(site_id,{kind,contentType:content_type,...(item_id===undefined?{}:{itemId:item_id}),content:JSON.stringify(payload),confirmChanges:user_confirmed},true,request_id);

  server.registerTool('wordrava_read_theme_appearance', {
    ...appearanceRead('Read theme appearance'), title:'Read WordPress appearance',
    description:'Inspect the active theme, core site title/tagline/logo/icon, exact native Custom CSS and its revision/snapshot. Reports block theme and preprocessing limitations. Requires Connector 1.2.3+. Does not read arbitrary theme options or third-party CSS fields.',
    inputSchema:siteIdentity,
  }, async ({site_id}) => compatibilityRead(site_id,'theme_read'));
  server.registerTool('wordrava_update_theme_identity', {
    ...appearanceWrite('Update theme identity'), title:'Update site identity',
    description:'Change exactly one core site title, tagline, logo attachment or site icon. Requires the active stylesheet, identity_revision from a fresh read, Read & Write profile, native capabilities and user approval of that exact change. Does not accept arbitrary option keys.',
    inputSchema:{...themeIdentity,...compatApproval,field:z.enum(['site_title','tagline','custom_logo','site_icon']),
      value:z.union([z.string().max(200),z.number().int().nonnegative()])},
  }, async ({site_id,stylesheet,expected_revision,field,value,user_confirmed,request_id}) => {
    if ((field==='site_title'||field==='tagline') ? typeof value!=='string' || (field==='site_title' && !value.trim()) : typeof value!=='number')
      return invalidBuilderInput();
    return compatibilityWrite(site_id,'theme_identity_update',{stylesheet,expected_revision,field,value},user_confirmed,request_id);
  });
  server.registerTool('wordrava_update_custom_css', {
    ...appearanceWrite('Update Custom CSS'), title:'Update native Custom CSS',
    description:'Replace only the active theme’s native Additional CSS with the exact approved CSS. First read existing CSS and css_revision; preserve unrelated rules. Requires full Read & Write profile and native edit_css capability. Stores a bounded local previous snapshot and verifies read-back; does not edit theme files or CSS from other plugins.',
    inputSchema:{...themeIdentity,...compatApproval,css:boundedCss},
  }, async ({site_id,stylesheet,expected_revision,css,user_confirmed,request_id}) =>
    compatibilityWrite(site_id,'theme_css_update',{stylesheet,expected_revision,css},user_confirmed,request_id));
  server.registerTool('wordrava_restore_custom_css', {
    ...appearanceWrite('Restore Custom CSS'), title:'Restore native Custom CSS snapshot',
    description:'Restore the latest WordRava CSS snapshot for the active theme only. Requires current css_revision, exact css_snapshot_revision and explicit approval. Restores CSS text, not files or all theme settings.',
    inputSchema:{...themeIdentity,...compatApproval,snapshot_revision:compatRevision},
  }, async ({site_id,stylesheet,expected_revision,snapshot_revision,user_confirmed,request_id}) =>
    compatibilityWrite(site_id,'theme_css_restore',{stylesheet,expected_revision,snapshot_revision},user_confirmed,request_id));
  server.registerTool('wordrava_list_theme_parts', {
    ...appearanceRead('List header and footer'), title:'List native header/footer template parts',
    description:'List existing native header and footer block template parts for the active block theme. Not classic PHP templates or Elementor/Divi/theme-specific header builders. Check truncated before claiming a complete inventory.',
    inputSchema:siteIdentity,
  }, async ({site_id}) => compatibilityRead(site_id,'theme_parts_list'));
  server.registerTool('wordrava_read_theme_part', {
    ...appearanceRead('Read header or footer'), title:'Read native header/footer',
    description:'Read one existing native header/footer block template part, its exact block markup, area, revision and latest snapshot revision. Use the stylesheet and slug returned by wordrava_list_theme_parts.',
    inputSchema:partIdentity,
  }, async ({site_id,stylesheet,slug}) => compatibilityRead(site_id,'theme_part_read',{stylesheet,slug}));
  server.registerTool('wordrava_update_theme_part', {
    ...appearanceWrite('Update header or footer'), title:'Update native header/footer',
    description:'Replace one existing active block-theme header/footer with explicitly approved, sanitized native block markup and unchanged revision. Creates a WordPress database override if the part was theme-supplied. Does not edit PHP/files, arbitrary templates or third-party header builders. Stores a bounded local snapshot and verifies the result.',
    inputSchema:{...partIdentity,...compatApproval,markup:boundedMarkup},
  }, async ({site_id,stylesheet,slug,expected_revision,markup,user_confirmed,request_id}) =>
    compatibilityWrite(site_id,'theme_part_update',{stylesheet,slug,expected_revision,markup},user_confirmed,request_id));
  server.registerTool('wordrava_restore_theme_part', {
    ...appearanceWrite('Restore header or footer'), title:'Restore native header/footer snapshot',
    description:'Restore the previous WordRava block markup snapshot of exactly one active-theme header/footer. Requires current and snapshot revision plus explicit approval. Retains the database override instead of deleting it or changing theme files.',
    inputSchema:{...partIdentity,...compatApproval,snapshot_revision:compatRevision},
  }, async ({site_id,stylesheet,slug,expected_revision,snapshot_revision,user_confirmed,request_id}) =>
    compatibilityWrite(site_id,'theme_part_restore',{stylesheet,slug,expected_revision,snapshot_revision},user_confirmed,request_id));
  server.registerTool('wordrava_read_polylang_translation', {
    ...appearanceRead('Read Polylang translation'), title:'Read Polylang translation group',
    description:'Inspect a post/page language, complete accessible linked translation IDs, configured languages and revision using active Polylang. Does not change content or translate text. Requires Connector 1.2.3+.',
    inputSchema:compatPoly,
  }, async ({site_id,content_type,item_id}) => compatibilityRead(site_id,'polylang_read',{},content_type,item_id));
  server.registerTool('wordrava_set_polylang_language', {
    ...appearanceWrite('Set Polylang language'), title:'Set language of unlinked content',
    description:'Assign a configured Polylang language to one unlinked post/page after approval and revision validation. Refuses a page already linked to other translations; never removes links silently or translates content.',
    inputSchema:{...compatPoly,...compatApproval,language:z.string().regex(/^[A-Za-z0-9_-]{1,32}(?![\s\S])/ )},
  }, async ({site_id,content_type,item_id,expected_revision,language,user_confirmed,request_id}) =>
    compatibilityWrite(site_id,'polylang_set_language',{language,expected_revision},user_confirmed,request_id,content_type,item_id));
  server.registerTool('wordrava_link_polylang_translations', {
    ...appearanceWrite('Link Polylang translations'), title:'Link existing translated pages',
    description:'Link two existing same-type posts/pages or nonconflicting Polylang translation groups. Inspect each group separately; supply both exact revisions and obtain approval of the merged language mapping. Refuses same-language conflicts and never removes or replaces existing links.',
    inputSchema:{...compatPoly,...compatApproval,target_id:z.number().int().positive(),expected_target_revision:compatRevision},
  }, async ({site_id,content_type,item_id,target_id,expected_revision,expected_target_revision,user_confirmed,request_id}) => {
    if(item_id===target_id) return invalidBuilderInput();
    return compatibilityWrite(site_id,'polylang_link',{target_id,expected_revision,expected_target_revision},user_confirmed,request_id,content_type,item_id);
  });
  server.registerTool('wordrava_read_builder', {
    outputSchema:queuedJobSchema,title:'Read native page builder',
    description:'Preview: inspect native Elementor or Gutenberg node inventory, parent IDs, supported fields/controls, document and latest snapshot revisions. Read a page of nodes, or one field/control with its exact node ID. Requires Center preview enabled and Connector 1.2.0. Not a generic page source replacement.',
    inputSchema:{...builderIdentity,builder:z.enum(['auto','elementor','gutenberg']),offset:z.number().int().min(0).max(5000).optional(),node_id:nodeId.optional(),field:builderField.optional(),control:controlKey.optional()},
    annotations:queuedRead,_meta:builderMeta(false,'Read page builder'),
  },async({site_id,content_type,item_id,builder,offset,node_id,field,control})=>{
    if((node_id===undefined)!==(field===undefined&&control===undefined)||(field!==undefined&&control!==undefined)||(node_id!==undefined&&offset!==undefined))return invalidBuilderInput();
    const query=node_id===undefined?{offset:offset??0}:control!==undefined?{node_id,control}:{node_id,field};
    return submit(site_id,{kind:'builder_read',contentType:content_type,itemId:item_id,title:builder,content:JSON.stringify(query)},false);
  });
  server.registerTool('wordrava_patch_builder', {
    outputSchema:queuedJobSchema,title:'Patch native page builder field',
    description:'Preview: replace one exact unique fragment in a supported Elementor/Gutenberg text or HTML field, after reading its current value and obtaining exact approval. Requires document hash and modified_gmt. No executable markup or generic metadata writes. Poll and verify.',
    inputSchema:{...builderIdentity,builder,node_id:nodeId,field:builderField,find:z.string().min(1).max(40000),replace:z.string().max(40000),...builderApproval},
    annotations:sensitiveWrite,_meta:builderMeta(true,'Patch page builder'),
  },async({site_id,content_type,item_id,builder,node_id,field,find,replace,expected_revision,expected_modified_gmt,user_confirmed,request_id})=>
    submit(site_id,{kind:'builder_patch',contentType:content_type,itemId:item_id,title:builder,content:JSON.stringify({node_id,field,find,replace,expected_revision}),expectedModifiedGmt:expected_modified_gmt,confirmChanges:user_confirmed},true,request_id));
  server.registerTool('wordrava_set_builder_control', {
    outputSchema:queuedJobSchema,title:'Set an Elementor control',
    description:'Preview: set one registered, allowlisted Elementor control using its exact key on an existing node. Read the control first. Supports selected color, typography, alignment, responsive dimensions, image attachment and link controls. Global/dynamic settings and arbitrary metadata are protected. Requires exact approval and fresh revision.',
    inputSchema:{...builderIdentity,node_id:nodeId,control:controlKey,value:builderControlValue,...builderApproval},
    annotations:sensitiveWrite,_meta:builderMeta(true,'Set Elementor control'),
  },async({site_id,content_type,item_id,node_id,control,value,expected_revision,expected_modified_gmt,user_confirmed,request_id})=>
    submit(site_id,{kind:'builder_control',contentType:content_type,itemId:item_id,title:'elementor',content:JSON.stringify({node_id,control,value,expected_revision}),expectedModifiedGmt:expected_modified_gmt,confirmChanges:user_confirmed},true,request_id));
  server.registerTool('wordrava_edit_builder_structure', {
    outputSchema:queuedJobSchema,title:'Insert, move or remove a native builder node',
    description:'Preview: insert one supported installed native widget/container or top-level core Gutenberg block, move one node, or remove one exact subtree. Read tree and parent IDs first. Use __document__ for the root. Position is zero-based in destination after removing a moved node. Elementor supports flex containers; Gutenberg supports top-level blocks only. Deletion may remove all descendants. User must approve the exact action and impact.',
    inputSchema:{...builderIdentity,builder,action:z.enum(['insert','move','remove']),node_id:nodeId.optional(),parent_id:nodeId.optional(),position:z.number().int().min(0).max(5000).optional(),node_type:z.enum(['container','heading','text-editor','html','button','image','divider','spacer','core/paragraph','core/heading','core/html','core/separator','core/spacer']).optional(),...builderApproval},
    annotations:sensitiveWrite,_meta:builderMeta(true,'Edit page structure'),
  },async({site_id,content_type,item_id,builder,action,node_id,parent_id,position,node_type,expected_revision,expected_modified_gmt,user_confirmed,request_id})=>{
    if(action==='insert'?(node_id!==undefined||parent_id===undefined||position===undefined||node_type===undefined):action==='move'?(node_id===undefined||parent_id===undefined||position===undefined||node_type!==undefined):(node_id===undefined||parent_id!==undefined||position!==undefined||node_type!==undefined))return invalidBuilderInput();
    const patch=action==='insert'?{parent_id,position,node_type}:action==='move'?{node_id,parent_id,position}:{node_id};
    return submit(site_id,{kind:'builder_structure',contentType:content_type,itemId:item_id,title:builder,content:JSON.stringify({action,expected_revision,...patch}),expectedModifiedGmt:expected_modified_gmt,confirmChanges:user_confirmed},true,request_id);
  });
  server.registerTool('wordrava_restore_builder_snapshot', {
    outputSchema:queuedJobSchema,title:'Restore latest native builder snapshot',
    description:'Preview: restore only the latest protected local pre-edit snapshot of one Elementor/Gutenberg document. Read current document and snapshot revisions first. This replaces the current native tree with the previous tree and may undo an entire edit. Obtain exact explicit approval. This is not full site backup or arbitrary revision history. Poll and reread.',
    inputSchema:{...builderIdentity,builder,snapshot_revision:builderRevision,...builderApproval},
    annotations:sensitiveWrite,_meta:builderMeta(true,'Restore builder snapshot'),
  },async({site_id,content_type,item_id,builder,snapshot_revision,expected_revision,expected_modified_gmt,user_confirmed,request_id})=>
    submit(site_id,{kind:'builder_restore',contentType:content_type,itemId:item_id,title:builder,content:JSON.stringify({snapshot_revision,expected_revision}),expectedModifiedGmt:expected_modified_gmt,confirmChanges:user_confirmed},true,request_id));
  server.registerTool('wordrava_list_themes', {
    outputSchema: queuedJobSchema,
    title: 'List installed themes',
    description: 'Queue an inventory of themes already installed on one connected WordPress site, including the active theme. Does not activate or install anything. Creates a read job and reserves site quota.',
    inputSchema: { site_id: z.string().uuid() }, annotations: queuedRead, _meta: { ...auth.oauthContentRead, 'openai/toolInvocation/invoking': "WordRava: List themes…", 'openai/toolInvocation/invoked': "WordRava: Request submitted" },
  }, async ({ site_id }) => submit(site_id, { kind: 'list_themes', contentType: 'post' }, false));
  server.registerTool('wordrava_activate_theme', {
    outputSchema: queuedJobSchema,
    title: 'Activate an installed theme',
    description: 'Activate exactly one already-installed WordPress theme after explicit approval. This changes the live site appearance. Requires local site-administration opt-in, switch_themes permission, and the exact currently active stylesheet. Does not install themes or alter theme files.',
    inputSchema: { site_id: z.string().uuid(), stylesheet, expected_active_stylesheet: stylesheet,
      user_confirmed: approved, request_id: requestId },
    annotations: externalSensitiveWrite, _meta: { ...auth.oauthContentWrite, 'openai/toolInvocation/invoking': "WordRava: Activate theme…", 'openai/toolInvocation/invoked': "WordRava: Request submitted" },
  }, async ({ site_id, stylesheet, expected_active_stylesheet, user_confirmed, request_id }) => submit(site_id, {
    kind: 'activate_theme', contentType: 'post', title: stylesheet, content: expected_active_stylesheet, confirmChanges: user_confirmed,
  }, true, request_id));
  server.registerTool('wordrava_activate_plugin', {
    outputSchema: queuedJobSchema,
    title: 'Activate an installed plugin',
    description: 'Activate one already-installed inactive WordPress plugin after approval. Plugin code will run and may affect the live site. Requires local site-administration opt-in, native permissions and unchanged inactive state. Does not install or update a plugin; the connector cannot manage itself.',
    inputSchema: { site_id: z.string().uuid(), plugin_file: pluginFile, expected_state: z.literal('inactive'),
      user_confirmed: approved, request_id: requestId },
    annotations: externalSensitiveWrite, _meta: { ...auth.oauthContentWrite, 'openai/toolInvocation/invoking': "WordRava: Activate plugin…", 'openai/toolInvocation/invoked': "WordRava: Request submitted" },
  }, async ({ site_id, plugin_file, expected_state, user_confirmed, request_id }) => submit(site_id, {
    kind: 'activate_plugin', contentType: 'post', title: plugin_file, content: expected_state, confirmChanges: user_confirmed,
  }, true, request_id));
  server.registerTool('wordrava_deactivate_plugin', {
    outputSchema: queuedJobSchema,
    title: 'Deactivate an installed plugin',
    description: 'Deactivate one currently active WordPress plugin after approval. Features provided by that plugin may stop working. Requires local site-administration opt-in, native permissions and unchanged active state. Does not delete files; the connector and network-active plugins are excluded.',
    inputSchema: { site_id: z.string().uuid(), plugin_file: pluginFile, expected_state: z.literal('active'),
      user_confirmed: approved, request_id: requestId },
    annotations: externalSensitiveWrite, _meta: { ...auth.oauthContentWrite, 'openai/toolInvocation/invoking': "WordRava: Deactivate plugin…", 'openai/toolInvocation/invoked': "WordRava: Request submitted" },
  }, async ({ site_id, plugin_file, expected_state, user_confirmed, request_id }) => submit(site_id, {
    kind: 'deactivate_plugin', contentType: 'post', title: plugin_file, content: expected_state, confirmChanges: user_confirmed,
  }, true, request_id));
  server.registerTool('wordrava_update_published', {
    outputSchema: queuedJobSchema,
    title: 'Update published content',
    description: 'Replace the title and body of one already-published classic WordPress post/page after approval. Do not replace page-builder documents; use the supported native preview tools. The change becomes public. Requires draft-write and publication opt-ins, native publication permission and the latest content revision. Does not edit page-builder structures or arbitrary metadata.',
    inputSchema: { site_id: z.string().uuid(), content_type: contentType, item_id: z.number().int().positive(),
      title: z.string().min(1).max(200), content: z.string().max(100000), expected_modified_gmt: revision,
      user_confirmed: approved, request_id: requestId },
    annotations: externalSensitiveWrite, _meta: { ...auth.oauthContentWrite, 'openai/toolInvocation/invoking': "WordRava: Update published…", 'openai/toolInvocation/invoked': "WordRava: Request submitted" },
  }, async ({ site_id, content_type, item_id, title, content, expected_modified_gmt, user_confirmed, request_id }) => submit(site_id, {
    kind: 'update_published', contentType: content_type, itemId: item_id, title, content,
    expectedModifiedGmt: expected_modified_gmt, confirmChanges: user_confirmed,
  }, true, request_id));
  server.registerTool('wordrava_trash_content', {
    outputSchema: queuedJobSchema,
    title: 'Move content to trash',
    description: 'Move one post/page to WordPress trash after explicit approval. Published content stops being available. Requires site-administration opt-in, native delete permission and unchanged revision. It does not permanently delete content.',
    inputSchema: { site_id: z.string().uuid(), content_type: contentType, item_id: z.number().int().positive(),
      expected_modified_gmt: revision, user_confirmed: approved, request_id: requestId },
    annotations: externalSensitiveWrite, _meta: { ...auth.oauthContentWrite, 'openai/toolInvocation/invoking': "WordRava: Trash content…", 'openai/toolInvocation/invoked': "WordRava: Request submitted" },
  }, async ({ site_id, content_type, item_id, expected_modified_gmt, user_confirmed, request_id }) => submit(site_id, {
    kind: 'trash_content', contentType: content_type, itemId: item_id, expectedModifiedGmt: expected_modified_gmt,
    confirmChanges: user_confirmed,
  }, true, request_id));
  server.registerTool('wordrava_restore_content', {
    outputSchema: queuedJobSchema,
    title: 'Restore content from trash',
    description: 'Restore one trashed WordPress post/page after approval. WordPress determines its restored status, which may affect visibility. Requires site-administration opt-in, native permissions and unchanged revision. Does not restore arbitrary snapshots or permanently deleted content.',
    inputSchema: { site_id: z.string().uuid(), content_type: contentType, item_id: z.number().int().positive(),
      expected_modified_gmt: revision, user_confirmed: approved, request_id: requestId },
    annotations: externalSensitiveWrite, _meta: { ...auth.oauthContentWrite, 'openai/toolInvocation/invoking': "WordRava: Restore content…", 'openai/toolInvocation/invoked': "WordRava: Request submitted" },
  }, async ({ site_id, content_type, item_id, expected_modified_gmt, user_confirmed, request_id }) => submit(site_id, {
    kind: 'restore_content', contentType: content_type, itemId: item_id, expectedModifiedGmt: expected_modified_gmt,
    confirmChanges: user_confirmed,
  }, true, request_id));
  server.registerTool('wordrava_get_seo', {
    outputSchema: queuedJobSchema,
    title: 'Read page SEO settings',
    description: 'Queue a read of supported per-post SEO settings from an installed, active Yoast SEO or All in One SEO adapter. Returns provider/version, fields, supported_fields, content revision and SEO revision. Auto selection fails when both providers are active. No global SEO settings, ranking guarantee or builder editing is implied.',
    inputSchema: { site_id: z.string().uuid(), content_type: contentType, item_id: z.number().int().positive(),
      provider: z.enum(['auto', 'yoast', 'aioseo']).default('auto') },
    annotations: queuedRead, _meta: { ...auth.oauthContentRead, 'openai/toolInvocation/invoking': "WordRava: Get seo…", 'openai/toolInvocation/invoked': "WordRava: Request submitted" },
  }, async ({ site_id, content_type, item_id, provider }) => submit(site_id, {
    kind: 'seo_read', contentType: content_type, itemId: item_id, title: provider, content: '{}',
  }, false));
  server.registerTool('wordrava_update_seo', {
    outputSchema: queuedJobSchema,
    title: 'Update page SEO settings',
    description: 'Update explicitly approved, adapter-supported SEO fields on one WordPress post/page. Requires local SEO and draft-write opt-ins; published content additionally requires publication permission. Both content and SEO revisions must match. Empty strings clear text/URL overrides; robots flags are booleans. Only fields listed as supported by this installed provider may be changed. This may change indexing and social previews.',
    inputSchema: { site_id: z.string().uuid(), content_type: contentType, item_id: z.number().int().positive(),
      provider: z.enum(['yoast', 'aioseo']), fields: seoFields, expected_modified_gmt: revision,
      expected_seo_revision: z.string().length(64).regex(/^[a-f0-9]{64}$/), user_confirmed: approved, request_id: requestId },
    annotations: externalSensitiveWrite, _meta: { ...auth.oauthContentWrite, 'openai/toolInvocation/invoking': "WordRava: Update seo…", 'openai/toolInvocation/invoked': "WordRava: Request submitted" },
  }, async ({ site_id, content_type, item_id, provider, fields, expected_modified_gmt, expected_seo_revision, user_confirmed, request_id }) => submit(site_id, {
    kind: 'seo_update', contentType: content_type, itemId: item_id, title: provider,
    content: JSON.stringify({ fields, expected_seo_revision }), expectedModifiedGmt: expected_modified_gmt,
    confirmChanges: user_confirmed,
  }, true, request_id));
}
