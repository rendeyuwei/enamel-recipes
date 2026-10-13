import type { FieldError } from "../../shared/domain.ts";

export class HttpError extends Error {
  statusCode: number;
  fields?: FieldError[];

  constructor(statusCode: number, message: string, fields?: FieldError[]) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.fields = fields;
  }
}
