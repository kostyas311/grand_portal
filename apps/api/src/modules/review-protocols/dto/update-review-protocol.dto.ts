import { PartialType } from '@nestjs/swagger';
import { CreateReviewProtocolDto } from './create-review-protocol.dto';

export class UpdateReviewProtocolDto extends PartialType(CreateReviewProtocolDto) {}
