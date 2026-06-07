import { z } from "zod";
import { BadRequestError } from "../utils/errors.js";

export const validate = (schemaObj) => (req, res, next) => {
  try {
    const schema = z.object(schemaObj);
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (schemaObj.body) req.body = parsed.body;
    if (schemaObj.query) req.query = parsed.query;
    if (schemaObj.params) req.params = parsed.params;

    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map((err) => {
        // err.path will be something like ["body", "username"]
        const path = err.path.slice(1).join(".");
        return {
          field: path || err.path[0],
          message: err.message,
        };
      });

      const err = new BadRequestError("Validation failed");
      err.errors = validationErrors;
      return next(err);
    }
    next(error);
  }
};
