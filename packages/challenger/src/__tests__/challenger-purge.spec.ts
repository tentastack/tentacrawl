import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChallengerApiService } from '../api/challenger.service';
import {
  ChallengerConfigEntity,
  ChallengerRegistrationEntity,
  ChallengerSignalEntity,
} from '../data/entities';

function makeService(reg: { id: string; status: string } | null) {
  const deletes: Array<{ entity: unknown; where: unknown }> = [];
  const em = {
    findOne: jest.fn(async () => reg),
    nativeDelete: jest.fn(async (entity: unknown, where: unknown) => {
      deletes.push({ entity, where });
      return 1;
    }),
  };
  return { service: new ChallengerApiService(em as never), em, deletes };
}

describe('ChallengerApiService.purge', () => {
  it('rejects purging an active extension', async () => {
    const { service, deletes } = makeService({ id: 'proxy/manual', status: 'active' });
    await expect(service.purge('proxy/manual')).rejects.toBeInstanceOf(BadRequestException);
    expect(deletes).toHaveLength(0);
  });

  it('purges registration, config, and signals for an archived extension', async () => {
    const { service, deletes } = makeService({ id: 'old/ext', status: 'archived' });
    await service.purge('old/ext');
    expect(deletes.map((d) => d.entity)).toEqual([
      ChallengerRegistrationEntity,
      ChallengerConfigEntity,
      ChallengerSignalEntity,
    ]);
    expect(deletes[0].where).toEqual({ id: 'old/ext' });
    expect(deletes[2].where).toEqual({ extensionId: 'old/ext' });
  });

  it('404s when the extension does not exist', async () => {
    const { service } = makeService(null);
    await expect(service.purge('missing/ext')).rejects.toBeInstanceOf(NotFoundException);
  });
});
