import { Plugin } from 'esbuild';
import got from 'got';

const CDN = 'https://cdn.skypack.dev/';
const PATTERN = 'skypack:';

const skypack: Plugin = {
  name: 'skypack-loader',
  setup(build) {
    build.onResolve({ filter: /^skypack:/i }, (args) => {
      const mod = args.path.replace(PATTERN, CDN);
      return ({
        path: mod,
        namespace: 'skypack-loader',
      });
    });

    build.onLoad({ filter: /.*/, namespace: 'skypack-loader' }, async (args) => {
      const { body } = await got(args.path);
      return {
        contents: body.replaceAll('\'/-/', `'${PATTERN}-/`),
      };
    });
  },
};

export default skypack;
