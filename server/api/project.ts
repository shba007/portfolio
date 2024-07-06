import fs from 'node:fs'
import path from 'node:path'
import { parseYAML } from 'confbox'
import type { BaseProject, GithubDetailsResponse, GithubReleaseResponse, Project, Technologies } from '~~/utils/types'

const config = useRuntimeConfig()

const filePath = path.join(process.cwd(), config.private.rootDir, 'projects.yml')
const fileContents = fs.readFileSync(filePath, 'utf8')
const projects = parseYAML<BaseProject[]>(fileContents)

export default defineEventHandler<Promise<Project[]>>(async (_event) => {
  try {
    const repos = (
      await Promise.all(
        projects.map(async ({ name, repo, createdAt, technologies, appURL, videoURL, images }): Promise<Project | null> => {
          if (repo == null) return null

          let details: GithubDetailsResponse | null = null
          let release: GithubReleaseResponse | null = null

          const [detailsResponse, releaseResponse] = await Promise.allSettled([
            $fetch<{ repo: GithubDetailsResponse }>(`/repos/${repo}`, {
              baseURL: 'https://ungh.cc',
            }),
            $fetch<{ release: GithubReleaseResponse }>(`/repos/${repo}/releases/latest`, {
              baseURL: 'https://ungh.cc',
            }),
          ])

          if (detailsResponse.status === 'fulfilled') details = detailsResponse.value.repo

          if (releaseResponse.status === 'fulfilled') release = releaseResponse.value.release

          const { frameworks, languages } = technologies

          console.log('images', images ?? [])

          return {
            name,
            repo,
            description: details?.description ?? '',
            version: release?.tag ?? 'v0.0.0',
            stars: details?.stars ?? 0,
            forks: details?.forks ?? 0,
            createdAt,
            updatedAt: details?.updatedAt ?? createdAt,
            technologies: [...frameworks, ...languages] as Technologies[],
            repoURL: `https://github.com/${repo}`,
            appURL,
            videoURL,
            images: images ?? [],
          }
        })
      )
    ).filter((value): value is Project => value !== null)

    return repos
  } catch (error: any) {
    console.error('API project GET', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Some Unknown Error Found',
    })
  }
})
