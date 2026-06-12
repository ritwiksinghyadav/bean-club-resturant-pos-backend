import { db } from "../db/index.js";
import { sql, and, ilike, or, desc, asc, isNull } from "drizzle-orm";

/**
 * Common pagination, searching, and sorting helper for Drizzle ORM
 * 
 * @param {object} tableSchema - The table schema object from db/schema.js (e.g. categories)
 * @param {object} queryModel - The db.query model (e.g. db.query.categories)
 * @param {object} options - Pagination, sorting, and searching options
 * @param {number|string} [options.page] - Current page number
 * @param {number|string} [options.limit] - Number of items per page
 * @param {string} [options.search] - Search string
 * @param {string[]} [options.searchColumns] - Columns to apply search to
 * @param {string} [options.sort] - Sorting specifier (e.g. "name.desc" or "createdAt.asc")
 * @param {any[]} [options.extraWhere] - Extra Drizzle where conditions
 * @param {object} [options.withRelations] - Drizzle relations config
 */
export const paginate = async (
  tableSchema,
  queryModel,
  {
    page,
    limit,
    search = "",
    searchColumns = ["name"],
    sort = "",
    extraWhere = [],
    withRelations = undefined,
  } = {}
) => {
  const isPaginationEnabled = page !== undefined || limit !== undefined;
  const parsedPage = isPaginationEnabled ? Math.max(1, parseInt(page) || 1) : null;
  const parsedLimit = isPaginationEnabled ? Math.max(1, parseInt(limit) || 10) : null;
  const offset = (parsedPage && parsedLimit) ? (parsedPage - 1) * parsedLimit : null;

  // Build where conditions
  const conditions = [...extraWhere];
  if (tableSchema.deletedAt) {
    conditions.push(isNull(tableSchema.deletedAt));
  }
  if (search && searchColumns.length > 0) {
    const searchConditions = searchColumns
      .filter(col => tableSchema[col])
      .map(col => sql`${tableSchema[col]} % ${search}`);
    
    if (searchConditions.length > 1) {
      conditions.push(or(...searchConditions));
    } else if (searchConditions.length === 1) {
      conditions.push(searchConditions[0]);
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build order by
  let orderByClause = [];
  if (sort) {
    const [field, direction] = sort.split(".");
    if (tableSchema[field]) {
      orderByClause = [direction === "asc" ? asc(tableSchema[field]) : desc(tableSchema[field])];
    }
  }
  if (orderByClause.length === 0 && tableSchema.createdAt) {
    orderByClause = [desc(tableSchema.createdAt)];
  }

  // Get total count
  const countQuery = db.select({ count: sql`count(*)::int` }).from(tableSchema);
  if (whereClause) {
    countQuery.where(whereClause);
  }
  const countResult = await countQuery;
  const totalItems = countResult[0]?.count || 0;

  // Build query options
  const queryOptions = {
    where: whereClause,
    orderBy: orderByClause,
  };

  if (withRelations) {
    queryOptions.with = withRelations;
  }

  if (parsedLimit !== null) {
    queryOptions.limit = parsedLimit;
  }

  if (offset !== null) {
    queryOptions.offset = offset;
  }

  // Get data
  const data = await queryModel.findMany(queryOptions);

  return {
    data,
    pagination: {
      totalItems,
      page: parsedPage || 1,
      limit: parsedLimit || totalItems,
      totalPages: parsedLimit ? Math.ceil(totalItems / parsedLimit) : 1,
    },
  };
};
