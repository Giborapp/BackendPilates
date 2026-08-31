import { IsString, IsUUID } from 'class-validator';

export class CreateReplacementLinkDto { @IsUUID() replacementCreditId!: string; }
export class ReplacementLinkTokenDto { @IsString() token!: string; }
export class ReserveReplacementDto { @IsUUID() classSessionId!: string; }
