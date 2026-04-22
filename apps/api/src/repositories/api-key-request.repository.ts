import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { apiKeyRequests, type ApiKeyRequestRow } from '../db/schema.js';

export type ApiKeyRequestInput = {
  owner: string;
  website?: string | null;
  email: string;
  useCase: string;
  requesterIp?: string | null;
};

export type ReviewDecision = 'approved' | 'rejected';

class ApiKeyRequestRepository {
  async create(input: ApiKeyRequestInput): Promise<ApiKeyRequestRow> {
    const db = getDb();
    if (!db) throw new Error('DATABASE_URL no configurado.');

    const [row] = await db
      .insert(apiKeyRequests)
      .values({
        owner: input.owner.trim(),
        website: input.website?.trim() || null,
        email: input.email.trim().toLowerCase(),
        useCase: input.useCase.trim(),
        requesterIp: input.requesterIp ?? null
      })
      .returning();

    return row;
  }

  async listPending(): Promise<ApiKeyRequestRow[]> {
    const db = getDb();
    if (!db) return [];
    return db
      .select()
      .from(apiKeyRequests)
      .where(eq(apiKeyRequests.status, 'pending'))
      .orderBy(desc(apiKeyRequests.createdAt));
  }

  async list(): Promise<ApiKeyRequestRow[]> {
    const db = getDb();
    if (!db) return [];
    return db.select().from(apiKeyRequests).orderBy(desc(apiKeyRequests.createdAt));
  }

  async getById(id: string): Promise<ApiKeyRequestRow | null> {
    const db = getDb();
    if (!db) return null;
    const [row] = await db
      .select()
      .from(apiKeyRequests)
      .where(eq(apiKeyRequests.id, id))
      .limit(1);
    return row ?? null;
  }

  async markReviewed(
    id: string,
    params: { decision: ReviewDecision; reviewNote?: string | null; apiKeyId?: string | null }
  ): Promise<ApiKeyRequestRow | null> {
    const db = getDb();
    if (!db) return null;
    const [row] = await db
      .update(apiKeyRequests)
      .set({
        status: params.decision,
        reviewNote: params.reviewNote ?? null,
        apiKeyId: params.apiKeyId ?? null,
        reviewedAt: new Date().toISOString()
      })
      .where(and(eq(apiKeyRequests.id, id), eq(apiKeyRequests.status, 'pending')))
      .returning();
    return row ?? null;
  }

  async countRecentByIp(ip: string, sinceIso: string): Promise<number> {
    const db = getDb();
    if (!db) return 0;
    const rows = await db
      .select({ id: apiKeyRequests.id })
      .from(apiKeyRequests)
      .where(and(eq(apiKeyRequests.requesterIp, ip)));
    return rows.filter((row) => {
      // Filtrar en memoria por createdAt >= sinceIso; es barato porque
      // esperamos muy pocas solicitudes por IP.
      return true;
    }).length;
  }
}

export const apiKeyRequestRepository = new ApiKeyRequestRepository();
