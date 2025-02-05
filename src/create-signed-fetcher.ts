import { SignatureV4 } from '@smithy/signature-v4';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { HttpRequest } from '@smithy/protocol-http';
import { Sha256 } from '@aws-crypto/sha256-js';
// import fetch, { Headers } from 'cross-fetch';
// import { Credentials, Provider, QueryParameterBag } from "@aws-sdk/types";
import { parseQueryString } from '@smithy/querystring-parser';
import { getFetchFn } from './get-fetch';
import { CreateSignedFetcher, SignedFetcherOptions } from './types';
import { getHeaders } from './get-headers';

// TODO
// export types
// publish as cjs and esm
// add github actions tets with DDB
// switch to vitest

/**
 * Create a signed fetch function that automatically signs requests with AWS Signature V4.
 * Service and region must be provided. Credentials can be provided if you want to sign requests with a specific set of credentials.
 * If no credentials are provided, the default credentials from `@aws-sdk/credential-provider-node` will be used.
 * See: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/request-signing.html#request-signing-node
 * @param init
 * @returns fetch
 */
export const createSignedFetcher: CreateSignedFetcher = (opts: SignedFetcherOptions): typeof fetch => {
  const service = opts.service; // TODO match service from URL
  const region = opts.region || 'us-east-1'; // TODO match region from URL
  const credentials = opts.credentials || defaultProvider();

  const fetchFn = getFetchFn(opts.fetch);

  return async (input, init?) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);

    const headers = getHeaders(init?.headers);
    // host is required by AWS Signature V4: https://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
    headers.set('host', url.host);

    const request = new HttpRequest({
      hostname: url.hostname,
      path: url.pathname,
      protocol: url.protocol,
      method: init?.method.toUpperCase(), // method must be uppercase
      body: init?.body,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: Object.fromEntries(headers.entries()),
    });

    const signer = new SignatureV4({
      credentials,
      service,
      region,
      sha256: Sha256,
    });

    const signedRequest = await signer.sign(request);

    return fetchFn(input, {
      headers: signedRequest.headers,
      body: signedRequest.body,
      method: signedRequest.method,
    });
  };
};
