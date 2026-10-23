# Taskly — Mobile

App di động Taskly, quản lý công việc kiểu Todoist. Backend nằm ở repo riêng (`backend`).

- **Stack:** React Native · Expo (TypeScript) · expo-router · TanStack Query · i18next
- **Vòng 1:** demo chạy bằng Expo Go trên Android emulator
- **Thiết kế:** xem spec `docs/superpowers/specs/2026-10-23-taskly-design.md` trong repo tài liệu gốc

## Cần có
- Node ≥ 22.13 (script `gen:api` dùng `--env-file-if-exists` và `import.meta.dirname`)
- Android Studio + một AVD (emulator). Expo Go tự được cài lên emulator lần đầu bấm `a`
- Backend đang chạy (xem README của repo `backend`)

## Chạy lần đầu
1. Chép `.env.example` thành `.env`.
2. Cài thư viện: `npm install`
3. Chạy app: `npx expo start`, rồi bấm `a` để mở trên emulator.

## Lệnh
| Việc | Lệnh |
|---|---|
| Chạy | `npx expo start` |
| Test | `npx jest` |
| Kiểm tra kiểu | `npx tsc --noEmit` |
| Sinh kiểu API từ backend | `npm run gen:api` |
| Kiểm `openapi-typescript` còn sinh kiểu đúng (không cần backend) | `npm run gen:api:smoke` |

## Hợp đồng API với backend
`src/api/types.gen.ts` được sinh từ OpenAPI của backend và **được commit vào repo này**, nên app build được mà
không cần backend đang chạy. Mỗi khi backend đổi API:
1. Chạy `npm run gen:api`.
2. Chạy `npx tsc --noEmit` để bắt chỗ lệch.
3. Commit file sinh ra.

**Vì sao `package.json` có `overrides`:** `openapi-typescript@7` khai báo peer `typescript ^5`, còn Expo SDK 58 dùng
TypeScript 6. `overrides` ép nó dùng chung bản TypeScript của dự án. Sau mỗi lần nâng `typescript` hoặc
`openapi-typescript`, chạy `npm run gen:api:smoke` để chắc việc sinh kiểu vẫn đúng; khi `openapi-typescript` hỗ trợ
TypeScript 6 chính thức thì bỏ `overrides`.
