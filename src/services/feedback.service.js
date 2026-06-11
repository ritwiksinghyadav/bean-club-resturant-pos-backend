import { db } from "../db/index.js";
import { feedbacks, users } from "../db/schema.js";
import { eq, and, desc, sql, or, ilike } from "drizzle-orm";
import { NotFoundError } from "../utils/errors.js";

export const submitFeedback = async ({ userId, subject, description, rating }) => {
  const [newFeedback] = await db
    .insert(feedbacks)
    .values({
      userId,
      subject,
      description,
      rating,
    })
    .returning();

  return newFeedback;
};

export const getAllFeedbacks = async (query = {}) => {
  const { page, perPage, rating, search } = query;

  const whereClauses = [];

  if (rating && rating !== "all") {
    whereClauses.push(eq(feedbacks.rating, parseInt(rating, 10)));
  }

  if (search) {
    whereClauses.push(
      or(
        ilike(users.name, `%${search}%`),
        ilike(users.phoneNumber, `%${search}%`),
        ilike(feedbacks.subject, `%${search}%`)
      )
    );
  }

  const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

  // 1. Calculate count
  const countRes = await db
    .select({ count: sql`count(*)` })
    .from(feedbacks)
    .leftJoin(users, eq(feedbacks.userId, users.id))
    .where(where);
  const totalItems = parseInt(countRes[0]?.count || 0, 10);

  // 2. Fetch average rating
  const avgRes = await db
    .select({ avg: sql`avg(${feedbacks.rating})` })
    .from(feedbacks);
  const averageRating = parseFloat(avgRes[0]?.avg || 0).toFixed(1);

  // 3. Fetch paginated feedbacks
  let limit = undefined;
  let offset = undefined;
  if (page && perPage) {
    limit = parseInt(perPage, 10);
    offset = (parseInt(page, 10) - 1) * limit;
  }

  const results = await db
    .select({
      id: feedbacks.id,
      subject: feedbacks.subject,
      description: feedbacks.description,
      rating: feedbacks.rating,
      createdAt: feedbacks.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        phoneNumber: users.phoneNumber,
      },
    })
    .from(feedbacks)
    .leftJoin(users, eq(feedbacks.userId, users.id))
    .where(where)
    .orderBy(desc(feedbacks.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    feedbacks: results,
    stats: {
      totalItems,
      averageRating: parseFloat(averageRating),
    },
    pagination: {
      totalItems,
      totalPages: limit ? Math.ceil(totalItems / limit) : 1,
      currentPage: page ? parseInt(page, 10) : 1,
      perPage: limit || totalItems,
    },
  };
};

export const deleteFeedback = async (id) => {
  const feedbackRecord = await db.query.feedbacks.findFirst({
    where: eq(feedbacks.id, id),
  });

  if (!feedbackRecord) {
    throw new NotFoundError("Feedback not found");
  }

  await db.delete(feedbacks).where(eq(feedbacks.id, id));
  return { id };
};
