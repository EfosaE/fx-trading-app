export class UserCreatedEvent {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly otpCode: string,
  ) {}
}
