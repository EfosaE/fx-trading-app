import { MigrationInterface, QueryRunner } from "typeorm";

export class CamelCaseForTS1773688072735 implements MigrationInterface {
    name = 'CamelCaseForTS1773688072735'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "full_name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otp_expiry" TIMESTAMP`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8cdb4d0c080c353c14479741d6"`);
        await queryRunner.query(`ALTER TABLE "wallet_balances" DROP COLUMN "currency"`);
        await queryRunner.query(`CREATE TYPE "public"."wallet_balances_currency_enum" AS ENUM('NGN', 'USD', 'EUR', 'GBP')`);
        await queryRunner.query(`ALTER TABLE "wallet_balances" ADD "currency" "public"."wallet_balances_currency_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "from_currency"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_from_currency_enum" AS ENUM('NGN', 'USD', 'EUR', 'GBP')`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "from_currency" "public"."transactions_from_currency_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "to_currency"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_to_currency_enum" AS ENUM('NGN', 'USD', 'EUR', 'GBP')`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "to_currency" "public"."transactions_to_currency_enum"`);
        await queryRunner.query(`ALTER TABLE "fx_rates" DROP COLUMN "base_currency"`);
        await queryRunner.query(`CREATE TYPE "public"."fx_rates_base_currency_enum" AS ENUM('NGN', 'USD', 'EUR', 'GBP')`);
        await queryRunner.query(`ALTER TABLE "fx_rates" ADD "base_currency" "public"."fx_rates_base_currency_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "fx_rates" DROP COLUMN "target_currency"`);
        await queryRunner.query(`CREATE TYPE "public"."fx_rates_target_currency_enum" AS ENUM('NGN', 'USD', 'EUR', 'GBP')`);
        await queryRunner.query(`ALTER TABLE "fx_rates" ADD "target_currency" "public"."fx_rates_target_currency_enum" NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8cdb4d0c080c353c14479741d6" ON "wallet_balances" ("user_id", "currency") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_8cdb4d0c080c353c14479741d6"`);
        await queryRunner.query(`ALTER TABLE "fx_rates" DROP COLUMN "target_currency"`);
        await queryRunner.query(`DROP TYPE "public"."fx_rates_target_currency_enum"`);
        await queryRunner.query(`ALTER TABLE "fx_rates" ADD "target_currency" character varying(3) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "fx_rates" DROP COLUMN "base_currency"`);
        await queryRunner.query(`DROP TYPE "public"."fx_rates_base_currency_enum"`);
        await queryRunner.query(`ALTER TABLE "fx_rates" ADD "base_currency" character varying(3) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "to_currency"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_to_currency_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "to_currency" character varying(3)`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "from_currency"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_from_currency_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "from_currency" character varying(3)`);
        await queryRunner.query(`ALTER TABLE "wallet_balances" DROP COLUMN "currency"`);
        await queryRunner.query(`DROP TYPE "public"."wallet_balances_currency_enum"`);
        await queryRunner.query(`ALTER TABLE "wallet_balances" ADD "currency" character varying(3) NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8cdb4d0c080c353c14479741d6" ON "wallet_balances" ("user_id", "currency") `);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_expiry"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "full_name"`);
    }

}
