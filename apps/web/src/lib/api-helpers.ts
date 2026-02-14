import { NextResponse } from "next/server";
import type { ApiError } from "@focus-reader/shared";

export function jsonError(
  error: string,
  code: string,
  status: number
): NextResponse<ApiError> {
  return NextResponse.json({ error, code, status }, { status });
}

export function json<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}
