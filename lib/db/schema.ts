import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * The domain model of the master plan §F. Every name here is generic on purpose: the engine
 * knows workspaces, connectors, signals, templates, renditions, slots, content items and assets,
 * and nothing about what any pack puts inside them. See docs/ai-agents-guide.md.
 */

export const socialPlatform = pgEnum('social_platform', ['instagram']);

export const connectorKind = pgEnum('connector_kind', ['webhook_push', 'http_pull']);

export const renditionFormat = pgEnum('rendition_format', [
  'feed_1x1',
  'feed_4x5',
  'story_9x16',
  'carousel',
]);

export const publishMode = pgEnum('publish_mode', ['auto', 'assisted']);

/** The pipeline of docs/architecture.md §pipeline. Terminal states are not failures by default. */
export const contentItemState = pgEnum('content_item_state', [
  'triggered',
  'gathering',
  'rendering',
  'review',
  'publishing',
  'published',
  'cancelled',
  'expired',
  'failed',
]);

const createdAt = timestamp('created_at', { withTimezone: true, mode: 'date' })
  .notNull()
  .defaultNow();

const updatedAt = timestamp('updated_at', { withTimezone: true, mode: 'date' })
  .notNull()
  .defaultNow();

/**
 * The tenant root: `workspace.id` is the `workspace_id` every other table carries. One workspace
 * is configured in v1 and the model supports N, so nothing may be scoped by anything else.
 */
export const workspace = pgTable('workspace', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt,
  updatedAt,
});

const workspaceId = uuid('workspace_id')
  .notNull()
  .references(() => workspace.id, { onDelete: 'cascade' });

export const socialAccount = pgTable(
  'social_account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId,
    platform: socialPlatform('platform').notNull(),
    igUserId: text('ig_user_id').notNull(),
    pageId: text('page_id').notNull(),
    // Long-lived and refreshed on a schedule; never logged, never mirrored into an env var.
    accessToken: text('access_token').notNull(),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true, mode: 'date' }),
    // IANA name. Stored times are UTC; this is the zone they are rendered and scheduled in.
    timezone: text('timezone').notNull(),
    dailyCap: integer('daily_cap').notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('social_account_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('social_account_platform_user_idx').on(
      table.workspaceId,
      table.platform,
      table.igUserId,
    ),
  ],
);

export const connector = pgTable(
  'connector',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId,
    key: text('key').notNull(),
    kind: connectorKind('kind').notNull(),
    config: jsonb('config').notNull().default({}),
    /** The JSON Schema an inbound trigger payload is validated against before anything else. */
    payloadSchema: jsonb('payload_schema').notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('connector_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('connector_workspace_key_idx').on(table.workspaceId, table.key),
  ],
);

export const signal = pgTable(
  'signal',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId,
    connectorId: uuid('connector_id')
      .notNull()
      .references(() => connector.id, { onDelete: 'cascade' }),
    /**
     * Opaque to the engine: the dedupe and cooldown identity, made stable by the pack that
     * emits it. Never parsed, never split, never interpreted here.
     */
    entityKey: text('entity_key').notNull(),
    payload: jsonb('payload').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true, mode: 'date' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    createdAt,
  },
  (table) => [
    index('signal_workspace_id_idx').on(table.workspaceId),
    index('signal_entity_key_idx').on(table.workspaceId, table.entityKey, table.fetchedAt),
    index('signal_connector_idx').on(table.connectorId, table.fetchedAt),
  ],
);

export const template = pgTable(
  'template',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId,
    /** The `template_key` of the inbound trigger contract. A breaking payload change gets a new one. */
    key: text('key').notNull(),
    connectorId: uuid('connector_id').references(() => connector.id, { onDelete: 'set null' }),
    dataBinding: jsonb('data_binding').notNull(),
    condition: jsonb('condition').notNull(),
    /** Per template: how long a gathered fact may be trusted before the revalidate gate re-reads it. */
    freshnessTtlSeconds: integer('freshness_ttl_seconds').notNull(),
    cooldownSeconds: integer('cooldown_seconds').notNull(),
    caption: text('caption').notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('template_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('template_workspace_key_idx').on(table.workspaceId, table.key),
  ],
);

/**
 * Renditions are authored, never derived: a story exists only because someone wrote one.
 * `publish_mode` sits here and not on the template, so one template can post its feed image
 * automatically and hand its story off for manual finishing.
 */
export const rendition = pgTable(
  'rendition',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId,
    templateId: uuid('template_id')
      .notNull()
      .references(() => template.id, { onDelete: 'cascade' }),
    format: renditionFormat('format').notNull(),
    layoutId: text('layout_id').notNull(),
    publishMode: publishMode('publish_mode').notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('rendition_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('rendition_template_format_idx').on(table.templateId, table.format),
  ],
);

export const slot = pgTable(
  'slot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId,
    socialAccountId: uuid('social_account_id')
      .notNull()
      .references(() => socialAccount.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** RFC 5545 recurrence rule, evaluated in `timezone` — not in the server's zone. */
    rrule: text('rrule').notNull(),
    timezone: text('timezone').notNull(),
    targetFormat: renditionFormat('target_format').notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('slot_workspace_id_idx').on(table.workspaceId),
    index('slot_social_account_idx').on(table.socialAccountId),
  ],
);

/**
 * `Slot.candidates`, ordered. The order *is* the fallback mechanism — evaluate by ascending
 * position, first passing condition wins — so it is stored as data and never left to insertion
 * order or to any implicit row ordering.
 */
export const slotCandidate = pgTable(
  'slot_candidate',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId,
    slotId: uuid('slot_id')
      .notNull()
      .references(() => slot.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => template.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    createdAt,
  },
  (table) => [
    index('slot_candidate_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('slot_candidate_slot_position_idx').on(table.slotId, table.position),
    uniqueIndex('slot_candidate_slot_template_idx').on(table.slotId, table.templateId),
  ],
);

/**
 * The state-machine unit. `payload_snapshot` is what was rendered; the revalidate gate diffs the
 * live signal against it before publishing, in every approval mode. `state_reason` carries the
 * operator-readable why for non-events — an empty slot and a stale cancel are correct outcomes,
 * not errors (docs/development-standards.md §5).
 */
export const contentItem = pgTable(
  'content_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId,
    socialAccountId: uuid('social_account_id')
      .notNull()
      .references(() => socialAccount.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => template.id, { onDelete: 'restrict' }),
    renditionId: uuid('rendition_id')
      .notNull()
      .references(() => rendition.id, { onDelete: 'restrict' }),
    slotId: uuid('slot_id').references(() => slot.id, { onDelete: 'set null' }),
    signalId: uuid('signal_id').references(() => signal.id, { onDelete: 'set null' }),
    entityKey: text('entity_key').notNull(),
    state: contentItemState('state').notNull(),
    stateReason: text('state_reason'),
    payloadSnapshot: jsonb('payload_snapshot').notNull(),
    caption: text('caption'),
    mediaUrl: text('media_url'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true, mode: 'date' }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('content_item_workspace_id_idx').on(table.workspaceId),
    index('content_item_state_idx').on(table.workspaceId, table.state, table.scheduledFor),
    // Cooldown and dedupe are asked per (template, entity_key); this is that question's index.
    index('content_item_template_entity_idx').on(
      table.templateId,
      table.entityKey,
      table.publishedAt,
    ),
  ],
);

export const publishAttempt = pgTable(
  'publish_attempt',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId,
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItem.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull(),
    request: jsonb('request').notNull(),
    response: jsonb('response'),
    /** Reconciled against before a retry, so a slow success cannot become a double post. */
    igMediaId: text('ig_media_id'),
    error: jsonb('error'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('publish_attempt_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('publish_attempt_item_attempt_idx').on(table.contentItemId, table.attempt),
    index('publish_attempt_media_idx').on(table.igMediaId),
  ],
);

/**
 * The curated media library. `entity_keys` are the same opaque pointers a signal carries, so an
 * asset can be matched to a fact without the engine knowing what either means.
 */
export const asset = pgTable(
  'asset',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId,
    /** Deliberately public: Meta fetches this URL itself, so a signed URL fails at publish time. */
    publicUrl: text('public_url').notNull(),
    entityKeys: text('entity_keys').array().notNull().default([]),
    tags: text('tags').array().notNull().default([]),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('asset_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('asset_workspace_url_idx').on(table.workspaceId, table.publicUrl),
  ],
);

export type Workspace = typeof workspace.$inferSelect;
export type NewWorkspace = typeof workspace.$inferInsert;
export type SocialAccount = typeof socialAccount.$inferSelect;
export type NewSocialAccount = typeof socialAccount.$inferInsert;
export type Connector = typeof connector.$inferSelect;
export type NewConnector = typeof connector.$inferInsert;
export type Signal = typeof signal.$inferSelect;
export type NewSignal = typeof signal.$inferInsert;
export type Template = typeof template.$inferSelect;
export type NewTemplate = typeof template.$inferInsert;
export type Rendition = typeof rendition.$inferSelect;
export type NewRendition = typeof rendition.$inferInsert;
export type Slot = typeof slot.$inferSelect;
export type NewSlot = typeof slot.$inferInsert;
export type SlotCandidate = typeof slotCandidate.$inferSelect;
export type NewSlotCandidate = typeof slotCandidate.$inferInsert;
export type ContentItem = typeof contentItem.$inferSelect;
export type NewContentItem = typeof contentItem.$inferInsert;
export type PublishAttempt = typeof publishAttempt.$inferSelect;
export type NewPublishAttempt = typeof publishAttempt.$inferInsert;
export type Asset = typeof asset.$inferSelect;
export type NewAsset = typeof asset.$inferInsert;

export type SocialPlatform = (typeof socialPlatform.enumValues)[number];
export type ConnectorKind = (typeof connectorKind.enumValues)[number];
export type RenditionFormat = (typeof renditionFormat.enumValues)[number];
export type PublishMode = (typeof publishMode.enumValues)[number];
export type ContentItemState = (typeof contentItemState.enumValues)[number];
