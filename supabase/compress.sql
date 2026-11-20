-- セーブデータの圧縮に対応する。SQL Editor で Run。何度実行しても安全。
-- 圧縮したセーブは zdata（gzip を base64 にした文字列）に入れ、data は空（null）にする。
-- 古いアプリは data が空のセーブを「無いもの」として扱うので、読めない形式を誤って上書きしない。
alter table public.saves add column if not exists zdata text;
alter table public.saves alter column data drop not null;

-- どちらか一方は必ず入っている。圧縮後の大きさにも上限を設ける（約2MB）
alter table public.saves drop constraint if exists saves_payload;
alter table public.saves add constraint saves_payload
  check ((data is not null or zdata is not null) and (zdata is null or char_length(zdata) <= 2000000));
