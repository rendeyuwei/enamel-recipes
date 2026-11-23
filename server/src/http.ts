import type { FieldError } from "../../shared/domain.ts";
import { zhError, type ErrorCode } from "../../shared/errors.ts";

export class HttpError extends Error {
  statusCode: number;
  code: ErrorCode;
  fields?: FieldError[];

  constructor(statusCode: number, code: ErrorCode, fields?: FieldError[]) {
    super(zhError(code));
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}
