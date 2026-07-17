import type { Request, Response, NextFunction } from 'express'

// Express 4 doesn't catch rejections thrown inside an async route handler —
// an unhandled one becomes an unhandled promise rejection, which crashes the
// whole Node process by default (confirmed in practice on this project: one
// bad request took the entire server down for every user). Wrapping every
// async handler forwards the error to Express's error middleware instead.
export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }
}
