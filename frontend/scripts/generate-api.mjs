import { fileURLToPath } from 'node:url'
import { generateApi } from 'swagger-typescript-api'

await generateApi({
  url: process.argv[2] ?? 'http://localhost:8000/openapi.json',
  output: fileURLToPath(new URL('../src/lib/generated', import.meta.url)),
  name: 'Api.ts',
  httpClientType: 'axios',
  enumStyle: 'union',
  typeOnlyImports: true,
})
