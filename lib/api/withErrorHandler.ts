import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiHandler = (req: Request, context?: any) => Promise<NextResponse>

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: Request, context?: any) => {
    try {
      return await handler(req, context)
    } catch (error) {
      console.error('[API Error]', {
        path: req.url,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
