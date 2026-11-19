import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@hey-api/openapi-ts';

const plugins = [
  '@hey-api/typescript',
  '@hey-api/sdk',
  '@hey-api/client-axios',
] as const;

function createServiceConfig(input: string, outputPath: string) {
  return {
    input,
    output: {
      path: outputPath,
      importFileExtension: null,
    },
    plugins: [...plugins],
  };
}

export default defineConfig(() => {
  if (process.env.OPENAPI_INPUT) {
    return createServiceConfig(
      process.env.OPENAPI_INPUT,
      process.env.OPENAPI_OUTPUT || 'src/api/generated/default',
    );
  }

  const swaggerDir = path.join(import.meta.dirname, 'src', 'api', 'swagger');
  if (!fs.existsSync(swaggerDir)) {
    return [];
  }

  return fs
    .readdirSync(swaggerDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const name = path.basename(entry.name, '.json');
      return createServiceConfig(
        `./src/api/swagger/${entry.name}`,
        `src/api/generated/${name}`,
      );
    });
});
