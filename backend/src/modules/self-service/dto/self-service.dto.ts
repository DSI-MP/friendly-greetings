import { IsOptional, IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class LocationChangeRequestDto {
  @IsNotEmpty() @IsString() locationName: string;
  @IsNotEmpty() @IsNumber() lat: number;
  @IsNotEmpty() @IsNumber() lng: number;
  @IsOptional() @IsString() reason?: string;
}

export class SubmitIssueDto {
  @IsNotEmpty() @IsString() subject: string;
  @IsNotEmpty() @IsString() description: string;
}

export class ReviewNoteDto {
  @IsOptional() @IsString() note?: string;
}
