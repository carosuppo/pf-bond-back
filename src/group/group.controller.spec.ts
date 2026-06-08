import { Test, TestingModule } from '@nestjs/testing';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';

describe('GroupController', () => {
  let controller: GroupController;
  let service: GroupService;
  let createGroupSpy: jest.SpyInstance<
    Promise<GroupResponseDto>,
    [CreateGroupDto]
  >;

  const responseDto: GroupResponseDto = {
    id: 1,
    name: 'Test Group',
    shareLocationMandatorily: false,
  };

  const mockGroupService = {
    createGroup: jest.fn().mockResolvedValue(responseDto),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupController],
      providers: [
        {
          provide: GroupService,
          useValue: mockGroupService,
        },
      ],
    }).compile();

    controller = module.get<GroupController>(GroupController);
    service = module.get<GroupService>(GroupService);
    createGroupSpy = jest.spyOn(service, 'createGroup');
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call GroupService.createGroup and return the result', async () => {
    const createGroupDto: CreateGroupDto = {
      name: 'Test Group',
      shareLocationMandatorily: false,
    };

    const result = await controller.create(createGroupDto);

    expect(createGroupSpy).toHaveBeenCalledWith(createGroupDto);
    expect(result).toEqual(responseDto);
  });
});
