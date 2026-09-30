import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

/** 422: la petición está bien escrita pero rompe una regla de negocio (sin stock, cupo superado...). */
export class ReglaDeNegocio extends UnprocessableEntityException {
  constructor(mensaje: string) {
    super({ statusCode: 422, message: mensaje });
  }
}

export class NoEncontrado extends NotFoundException {
  constructor(que: string) {
    super({ statusCode: 404, message: `${que} no existe` });
  }
}
