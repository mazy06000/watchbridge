import type { NormalizedLibrary } from '../domain/media'
import type { ImportCommitResult } from '../domain/tracker'
import type { TrackerRepository } from '../ports/tracker-repository'

export async function commitTvTimeLibraryImport(input: {
  userId: string
  jobId: string
  library: NormalizedLibrary
  repository: TrackerRepository
}): Promise<ImportCommitResult> {
  if (input.library.source !== 'tvtime-gdpr') {
    throw new Error('Unsupported import source.')
  }

  return input.repository.commitTvTimeImport({
    userId: input.userId,
    jobId: input.jobId,
    library: input.library
  })
}
