import { ProxyServerService } from '../api/proxy-server.service';

const base = {
  id: 's1',
  name: 'eu',
  enabled: true,
  location: 'PL',
  username: 'user',
  password: 'secret',
  notes: undefined,
  endpoints: [
    { id: 'e1', url: 'http://gw:8080', timesUsed: 0, timesSucceeded: 0, timesFailed: 0 },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function withFindOne(entity: unknown): ProxyServerService {
  const em = { findOne: jest.fn(async () => entity) };
  return new ProxyServerService(em as never);
}

describe('proxy credential masking', () => {
  it('getOne never returns the password and reports hasPassword', async () => {
    const res = (await withFindOne(base).getOne('s1')) as unknown as Record<string, unknown>;
    expect('password' in res).toBe(false);
    expect(res.hasPassword).toBe(true);
    expect(res.username).toBe('user');
  });

  it('reports hasPassword=false when no password is set', async () => {
    const res = await withFindOne({ ...base, password: undefined }).getOne('s1');
    expect(res.hasPassword).toBe(false);
  });

  it('list strips passwords from every row', async () => {
    const em = {
      findAndCount: jest.fn(async () => [[base, { ...base, id: 's2' }], 2]),
    };
    const svc = new ProxyServerService(em as never);
    const { data, total } = await svc.list({
      limit: 20,
      offset: 0,
      sort: 'name',
      order: 'asc',
    } as never);
    expect(total).toBe(2);
    expect(data.every((row) => !('password' in (row as unknown as Record<string, unknown>)))).toBe(true);
    expect(data.every((row) => row.hasPassword === true)).toBe(true);
  });
});

describe('resolveTestCredentials', () => {
  it('uses the submitted password as-is when one was retyped, without touching the db', async () => {
    const findOne = jest.fn();
    const svc = new ProxyServerService({ findOne } as never);

    const result = await svc.resolveTestCredentials({
      url: 'http://gw:8080',
      serverId: 's1',
      username: 'user',
      password: 'retyped',
    });

    expect(result).toEqual({ username: 'user', password: 'retyped' });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('leaves a blank password blank when there is no serverId (server not yet saved)', async () => {
    const svc = withFindOne(base);
    const result = await svc.resolveTestCredentials({
      url: 'http://gw:8080',
      username: 'user',
      password: '',
    });
    expect(result).toEqual({ username: 'user', password: '' });
  });

  it('falls back to the stored password when blank and the username is unchanged', async () => {
    const svc = withFindOne(base);
    const result = await svc.resolveTestCredentials({
      url: 'http://gw:8080',
      serverId: 's1',
      username: 'user',
      password: '',
    });
    expect(result).toEqual({ username: 'user', password: 'secret' });
  });

  it('falls back to stored credentials when the username field was never touched', async () => {
    const svc = withFindOne(base);
    const result = await svc.resolveTestCredentials({
      url: 'http://gw:8080',
      serverId: 's1',
    });
    expect(result).toEqual({ username: 'user', password: 'secret' });
  });

  it('does not fall back when the username was changed to something else', async () => {
    const svc = withFindOne(base);
    const result = await svc.resolveTestCredentials({
      url: 'http://gw:8080',
      serverId: 's1',
      username: 'someone-else',
      password: '',
    });
    expect(result).toEqual({ username: 'someone-else', password: '' });
  });

  it('leaves credentials as-is when the referenced server no longer exists', async () => {
    const svc = withFindOne(null);
    const result = await svc.resolveTestCredentials({
      url: 'http://gw:8080',
      serverId: 'missing',
      username: 'user',
      password: '',
    });
    expect(result).toEqual({ username: 'user', password: '' });
  });
});
