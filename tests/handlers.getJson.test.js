'use strict';

jest.mock('../src/config/env', () => ({
  getConfig: jest.fn(() => ({ region: 'us-east-1', bucket: 'my-bucket', prefix: 'p' }))
}));

jest.mock('../src/services/s3Service', () => ({
  createS3Client: jest.fn(() => ({ client: true })),
  getJson: jest.fn()
}));

const { handler } = require('../src/handlers/getJson');
const s3Service = require('../src/services/s3Service');

describe('getJson handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with payload when key exists', async () => {
    s3Service.getJson.mockResolvedValue({ key: 'p/file.json', data: { hello: 'world' } });

    const result = await handler(
      {
        path: '/json/file.json',
        httpMethod: 'GET',
        pathParameters: { key: 'file.json' }
      },
      { awsRequestId: 'req-1' }
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ hello: 'world' });
  });

  test('returns 404 when service throws NOT_FOUND', async () => {
    const error = new Error('missing');
    error.code = 'NOT_FOUND';
    s3Service.getJson.mockRejectedValue(error);

    const result = await handler(
      {
        path: '/json/missing.json',
        httpMethod: 'GET',
        pathParameters: { key: 'missing.json' }
      },
      { awsRequestId: 'req-2' }
    );

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: 'Not Found' });
  });


  test('returns 400 when key path param missing', async () => {
    const result = await handler({ path: '/json' }, { awsRequestId: 'req-4' });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: 'Path parameter "key" is required' });
  });
  test('returns 500 for unexpected errors', async () => {
    s3Service.getJson.mockRejectedValue(new Error('boom'));

    const result = await handler(
      {
        path: '/json/file.json',
        httpMethod: 'GET',
        pathParameters: { key: 'file.json' }
      },
      { awsRequestId: 'req-3' }
    );

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ message: 'Internal Server Error' });
  });
});

