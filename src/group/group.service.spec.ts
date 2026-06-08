import { Test, TestingModule } from '@nestjs/testing';
import { Group } from '@prisma/client';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupService } from './group.service';
import { GroupMapper } from './mapper/group.mapper';
import type { IGroupRepository } from './repository/group.repository.interface';

describe('GroupService', () => {
  let service: GroupService;
  let repository: IGroupRepository;
  let repositoryCreateSpy: jest.SpyInstance<
    Promise<Group>,
    [import('./dto/create-group.dto').CreateGroupDto]
  >;

  const groupEntity: Group = {
    id: 1,
    name: 'Test Group',
    shareLocationMandatorily: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
  };

  const mockRepository = {
    create: jest.fn().mockResolvedValue(groupEntity),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        {
          provide: 'groupRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<GroupService>(GroupService);
    repository = module.get<IGroupRepository>('groupRepository');
    repositoryCreateSpy = jest.spyOn(mockRepository, 'create');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a group and return a response DTO', async () => {
    const createGroupDto: CreateGroupDto = {
      name: 'Test Group',
      shareLocationMandatorily: true,
    };

    const result = await service.createGroup(createGroupDto);

    expect(repositoryCreateSpy).toHaveBeenCalledWith(
      GroupMapper.toPersistence(createGroupDto),
    );
    expect(result).toEqual({
      id: groupEntity.id,
      name: groupEntity.name,
      shareLocationMandatorily: groupEntity.shareLocationMandatorily,
    });
  });

  it('should default shareLocationMandatorily to false when it is undefined', async () => {
    const createGroupDto: CreateGroupDto = {
      name: 'Test Group',
    };

    await service.createGroup(createGroupDto);

    expect(repositoryCreateSpy).toHaveBeenCalledWith({
      name: createGroupDto.name,
      shareLocationMandatorily: false,
    });
  });
});
