import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { Brand } from '../domain/brand.entity.js';
import { CreateBrandUseCase } from '../application/create-brand.use-case.js';
import { GetBrandsUseCase } from '../application/get-brands.use-case.js';
import { GetBrandUseCase } from '../application/get-brand.use-case.js';
import { UpdateBrandUseCase } from '../application/update-brand.use-case.js';
import { DeleteBrandUseCase } from '../application/delete-brand.use-case.js';
import { createBrandSchema, type CreateBrandDto } from './schemas/create-brand.schema.js';
import { updateBrandSchema, type UpdateBrandDto } from './schemas/update-brand.schema.js';

@Controller('brands')
export class BrandController {
  constructor(
    private readonly createBrandUseCase: CreateBrandUseCase,
    private readonly getBrandsUseCase: GetBrandsUseCase,
    private readonly getBrandUseCase: GetBrandUseCase,
    private readonly updateBrandUseCase: UpdateBrandUseCase,
    private readonly deleteBrandUseCase: DeleteBrandUseCase,
  ) {}

  /**
   * Crea una nueva marca y su perfil asociado para la IA.
   * Valida la entrada usando Zod (createBrandSchema) antes de llegar aquí.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body({ schema: createBrandSchema }) body: CreateBrandDto,
  ): Promise<{ brand: Brand }> {
    const brand = await this.createBrandUseCase.execute(body);
    return { brand };
  }

  /**
   * Obtiene la lista completa de marcas, ordenadas por fecha de creación (descendente).
   */
  @Get()
  async findAll(): Promise<{ brands: Brand[] }> {
    const brands = await this.getBrandsUseCase.execute();
    return { brands };
  }

  /**
   * Obtiene los detalles de una marca específica por su ID.
   * Si no existe, se lanzará un BrandNotFoundError que el filtro global traduce a 404 HTTP.
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<{ brand: Brand }> {
    const brand = await this.getBrandUseCase.execute(id);
    return { brand };
  }

  /**
   * Actualiza parcialmente la información de una marca.
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body({ schema: updateBrandSchema }) body: UpdateBrandDto,
  ): Promise<{ brand: Brand }> {
    const brand = await this.updateBrandUseCase.execute({ id, ...body });
    return { brand };
  }

  /**
   * Elimina una marca de forma permanente por su ID.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.deleteBrandUseCase.execute(id);
  }
}
