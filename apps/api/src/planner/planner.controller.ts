import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PlannerService } from './planner.service';

@Roles('SOCIO', 'COMMUNITY_MANAGER')
@Controller('planner')
export class PlannerController {
  constructor(private plannerService: PlannerService) {}

  @Get('posts')
  findAll() {
    return this.plannerService.findAll();
  }

  @Get('resumen')
  resumen() {
    return this.plannerService.resumen();
  }

  @Get('kanban')
  kanban() {
    return this.plannerService.kanban();
  }

  @Post('posts')
  create(@Body() dto: CreatePostDto) {
    return this.plannerService.create(dto);
  }

  @Patch('posts/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.plannerService.update(id, dto);
  }

  @Delete('posts/:id')
  remove(@Param('id') id: string) {
    return this.plannerService.remove(id);
  }
}
