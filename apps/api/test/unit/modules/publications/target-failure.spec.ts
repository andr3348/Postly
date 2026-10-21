import {
  classifyTargetFailure,
  resolveTargetFailure,
} from '../../../../src/modules/publications/domain/target-failure.js';
import { BASE_TARGET } from './test-stubs.js';

describe('classifyTargetFailure', () => {
  it('classifies the obsolete Instagram VIDEO media type as retryable media', () => {
    const failure = classifyTargetFailure({
      stage: 'MEDIA_PREPARATION',
      errorMessage:
        '400 - {"error":{"message":"The media type is not supported","type":"OAuthException","code":100,"error_subcode":2207067,"is_transient":false,"fbtrace_id":"trace-ig"}}',
    });

    expect(failure).toMatchObject({
      kind: 'MEDIA',
      stage: 'MEDIA_PREPARATION',
      retryable: true,
      requiresAction: true,
      code: 100,
      subcode: 2207067,
      httpStatus: 400,
      isTransient: false,
      traceId: 'trace-ig',
    });
  });

  it('classifies the Facebook image error as retryable media', () => {
    const failure = classifyTargetFailure({
      stage: 'PUBLISH',
      errorMessage:
        '400 - {"error":{"message":"Invalid image file","type":"OAuthException","code":324,"error_subcode":2069019,"is_transient":true}}',
    });

    expect(failure).toMatchObject({
      kind: 'MEDIA',
      retryable: true,
      requiresAction: true,
      code: 324,
      subcode: 2069019,
    });
  });

  it('does not offer retry for auth, permission, or invalid content', () => {
    expect(
      classifyTargetFailure({
        stage: 'PUBLISH',
        errorMessage: '400 - {"error":{"code":190,"type":"OAuthException"}}',
      }),
    ).toMatchObject({ kind: 'AUTH', retryable: false });

    expect(
      classifyTargetFailure({
        stage: 'PUBLISH',
        errorMessage: '403 - {"error":{"code":10,"type":"OAuthException"}}',
      }),
    ).toMatchObject({ kind: 'PERMISSION', retryable: false });

    expect(
      classifyTargetFailure({
        stage: 'PUBLISH',
        errorMessage: '400 - {"error":{"code":2207026}}',
      }),
    ).toMatchObject({ kind: 'CONTENT', retryable: false });
  });

  it('offers retry for rate limits and transient container errors', () => {
    expect(
      classifyTargetFailure({
        stage: 'PUBLISH',
        errorMessage: '429 - {"error":{"code":4,"message":"Application request limit reached"}}',
      }),
    ).toMatchObject({ kind: 'RATE_LIMIT', retryable: true, httpStatus: 429 });

    expect(
      classifyTargetFailure({
        stage: 'MEDIA_PREPARATION',
        errorMessage: '400 - {"error":{"code":9007,"message":"Media not ready"}}',
      }),
    ).toMatchObject({ kind: 'TRANSIENT', retryable: true });
  });

  it('marks an unknown 5xx during PUBLISH as UNKNOWN_OUTCOME without retry', () => {
    const failure = classifyTargetFailure({
      stage: 'PUBLISH',
      errorMessage: '500 - upstream timeout',
    });

    expect(failure).toMatchObject({
      kind: 'UNKNOWN_OUTCOME',
      retryable: false,
      requiresAction: true,
      httpStatus: 500,
    });
  });

  it('can retry the same transient error during media preparation', () => {
    expect(
      classifyTargetFailure({
        stage: 'MEDIA_PREPARATION',
        errorMessage: '503 - service unavailable',
      }),
    ).toMatchObject({ kind: 'TRANSIENT', retryable: true });
  });

  it('treats an unknown 4xx provider rejection as safe to retry', () => {
    expect(
      classifyTargetFailure({
        stage: 'PUBLISH',
        errorMessage: '400 - {"error":{"code":1234,"message":"Invalid parameter"}}',
      }),
    ).toMatchObject({ kind: 'PROVIDER_REJECTED', retryable: true });
  });

  it('uses a structured error without parsing text', () => {
    const failure = classifyTargetFailure({
      stage: 'PUBLISH',
      error: {
        code: 613,
        message: 'Calls to this api have exceeded the rate limit',
        httpStatus: 400,
      },
    });

    expect(failure).toMatchObject({
      kind: 'RATE_LIMIT',
      retryable: true,
      code: 613,
      providerMessage: 'Calls to this api have exceeded the rate limit',
    });
  });
});

describe('resolveTargetFailure', () => {
  it('classifies a legacy error without stored failure JSON', () => {
    const legacy = {
      ...BASE_TARGET,
      status: 'FAILED' as const,
      errorMessage: '400 - {"error":{"code":4,"message":"rate limit"}}',
    };

    expect(resolveTargetFailure(legacy)).toMatchObject({
      kind: 'RATE_LIMIT',
      retryable: true,
    });
  });

  it('returns null when there is no error to classify', () => {
    expect(resolveTargetFailure(BASE_TARGET)).toBeNull();
  });
});
