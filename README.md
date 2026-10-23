# Taskly — Mobile

App di động Taskly, quản lý công việc kiểu Todoist. Backend nằm ở repo riêng (`backend`).

- **Stack:** React Native · Expo (TypeScript) · expo-router · TanStack Query · i18next
- **Vòng 1:** demo chạy bằng Expo Go trên Android emulator
- **Thiết kế:** xem spec `docs/superpowers/specs/2026-10-23-taskly-design.md` trong repo tài liệu gốc

## Cần có
- Node 22 LTS
- Android Studio + một AVD (emulator), đã cài app **Expo Go** trên emulator
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

## Hợp đồng API với backend
`src/api/types.gen.ts` được sinh từ OpenAPI của backend và **được commit vào repo này**, nên app build được mà
không cần backend đang chạy. Mỗi khi backend đổi API:
1. Chạy `npm run gen:api`.
2. Chạy `npx tsc --noEmit` để bắt chỗ lệch.
3. Commit file sinh ra.
