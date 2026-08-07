import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { socialAccount, workspace } from './schema.ts';
import type { SocialPlatform } from './schema.ts';

/**
 * Local imports carry an explicit `.ts` extension because `pnpm db:seed` runs this module through
 * Node's type stripping, which resolves specifiers as plain ESM and will not guess an extension.
 */

/**
 * What a pack must supply to be registered. A pack declares this shape without importing it —
 * `lib/db/` sits below `packs/` and may not be imported by one — so conformance is checked
 * structurally at the composition root that brings the two together.
 */
export interface PackRegistration {
  readonly key: string;
  readonly workspaceName: string;
  readonly account: {
    readonly platform: SocialPlatform;
    readonly timezone: string;
    readonly dailyCap: number;
  };
}

export interface SeedOutcome {
  readonly workspaceId: string;
  readonly socialAccountId: string;
  readonly createdWorkspace: boolean;
  readonly createdSocialAccount: boolean;
}

/** Instagram publishes at most 100 posts per rolling 24 h. An account's own cap must stay under it. */
export const PLATFORM_DAILY_CAP_CEILING = 100;

/**
 * `ig_user_id`, `page_id` and `access_token` are NOT NULL, so the row cannot be created without
 * them. Empty is the "never connected" state: the OAuth exchange in P2 writes the real values.
 * The seed must never carry a credential.
 */
const UNCONNECTED = '';

type SeedDatabase = PgDatabase<PgQueryResultHKT, Record<string, unknown>, Record<string, never>>;

/**
 * Creates the one workspace and the one social account a pack registers, and is safe to run
 * again: the workspace is matched by name, the account by platform within that workspace. Matching
 * the account on platform rather than on `ig_user_id` is deliberate — once P2 fills in the real
 * Instagram identity, a re-run must still recognise the row rather than add a second one.
 */
export async function seedWorkspace(
  db: SeedDatabase,
  registration: PackRegistration,
): Promise<SeedOutcome> {
  if (registration.account.dailyCap >= PLATFORM_DAILY_CAP_CEILING) {
    throw new Error(
      `Pack '${registration.key}' seeds a daily cap of ${registration.account.dailyCap}, which is ` +
        `not below the platform ceiling of ${PLATFORM_DAILY_CAP_CEILING} posts per rolling 24 h.`,
    );
  }

  const existingWorkspaces = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.name, registration.workspaceName))
    .limit(1);

  const existingWorkspace = existingWorkspaces[0];
  let workspaceId: string;

  if (existingWorkspace === undefined) {
    const inserted = await db
      .insert(workspace)
      .values({ name: registration.workspaceName })
      .returning({ id: workspace.id });

    const insertedWorkspace = inserted[0];
    if (insertedWorkspace === undefined) {
      throw new Error(`Failed to create workspace '${registration.workspaceName}'.`);
    }
    workspaceId = insertedWorkspace.id;
  } else {
    workspaceId = existingWorkspace.id;
  }

  const existingAccounts = await db
    .select({ id: socialAccount.id })
    .from(socialAccount)
    .where(
      and(
        eq(socialAccount.workspaceId, workspaceId),
        eq(socialAccount.platform, registration.account.platform),
      ),
    )
    .limit(1);

  const existingAccount = existingAccounts[0];

  if (existingAccount !== undefined) {
    return {
      workspaceId,
      socialAccountId: existingAccount.id,
      createdWorkspace: existingWorkspace === undefined,
      createdSocialAccount: false,
    };
  }

  const insertedAccounts = await db
    .insert(socialAccount)
    .values({
      workspaceId,
      platform: registration.account.platform,
      igUserId: UNCONNECTED,
      pageId: UNCONNECTED,
      accessToken: UNCONNECTED,
      timezone: registration.account.timezone,
      dailyCap: registration.account.dailyCap,
    })
    .returning({ id: socialAccount.id });

  const insertedAccount = insertedAccounts[0];
  if (insertedAccount === undefined) {
    throw new Error(`Failed to create a ${registration.account.platform} account.`);
  }

  return {
    workspaceId,
    socialAccountId: insertedAccount.id,
    createdWorkspace: existingWorkspace === undefined,
    createdSocialAccount: true,
  };
}
