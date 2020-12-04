import { Plugin } from 'esbuild';
import got from 'got';

const CDN = 'https://cdn.skypack.dev/';
const PATTERN = 'skypack:';

const REQUESTS = new Map<string, Promise<string>>();

function getCDN(url: string): Promise<string> {
  const current = REQUESTS.get(url);
  if (current) {
    return current;
  }

  const response = new Promise<string>((resolve, reject) => {
    got(url).then(
      (res) => resolve(res.body),
      reject,
    );
  });
  REQUESTS.set(url, response);
  return response;
}

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
      const body = await getCDN(args.path);
      return {
        contents: body.replaceAll('\'/-/', `'${PATTERN}-/`),
      };
    });
  },
};

export default skypack;
