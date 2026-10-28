# Taskly — Mobile

App di động Taskly, quản lý công việc kiểu Todoist. Backend nằm ở repo riêng (`backend`).

- **Stack:** React Native · Expo (TypeScript) · expo-router · TanStack Query · i18next
- **Vòng 1:** demo chạy bằng **development build** (APK riêng `com.taskly.app`, dùng `expo-dev-client`) trên
  Android emulator
- **Thiết kế:** xem spec `docs/superpowers/specs/2026-10-23-taskly-design.md` trong repo tài liệu gốc

## Cần có
- Node ≥ 22.13 (script `gen:api` dùng `--env-file-if-exists` và `import.meta.dirname`)
- Android Studio (Android SDK + JDK đi kèm) + một AVD (emulator) đang bật, dùng system image **Google APIs** hoặc
  **Google Play** (cần Google Play Services để đăng nhập Google)
- `adb` nằm ở `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` (thêm thư mục này vào `PATH`, hoặc gọi bằng
  đường dẫn đầy đủ). `npx expo run:android` cần biến `ANDROID_HOME` trỏ tới `%LOCALAPPDATA%\Android\Sdk`.
- Backend đang chạy ở cổng 8080 (xem README của repo `backend`)

## Chạy app
Thư mục `android/` do `npx expo run:android` sinh ra (CNG) và không commit.

### Lần đầu (build + cài APK)
1. Chép `.env.example` thành `.env`, điền `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (xem mục "Đăng nhập Google (cần Web client ID)").
2. Cài thư viện: `npm install`
3. Chuyển cổng backend vào emulator: `adb reverse tcp:8080 tcp:8080`
4. Build và cài app lên emulator: `npx expo run:android` (lần đầu Gradle có thể mất 10–20 phút).

Chỉ cần build lại khi đổi thư viện native, plugin hoặc cấu hình native trong `app.json`.

### Hằng ngày
1. `adb reverse tcp:8080 tcp:8080`
2. `npx expo start --dev-client` (hoặc `npm start`)
3. Mở app **Taskly** trên emulator; app tự nối vào Metro (nếu không, bấm `a` trong cửa sổ Metro).

### Kết nối backend từ emulator Android 17
Emulator Android 17 (API 37) chặn app gọi `10.0.2.2` vì coi đó là mạng nội bộ — app phải có quyền
`ACCESS_LOCAL_NETWORK` ([tài liệu](https://developer.android.com/privacy-and-security/local-network-permission)),
nếu không kết nối kẹt ở `SYN_SENT`. Taskly không xin quyền này; thay vào đó app gọi `http://localhost:8080` và
`adb reverse tcp:8080 tcp:8080` chuyển cổng 8080 của emulator về máy tính. Lệnh này mất tác dụng khi emulator tắt, nên
**chạy lại mỗi lần bật emulator** (kiểm bằng `adb reverse --list`). Metro (cổng 8081) thường được Expo CLI tự
`adb reverse`; nếu app không tải được bundle thì chạy thêm `adb reverse tcp:8081 tcp:8081`.

## Đăng nhập Google (cần Web client ID)
Thư viện `@react-native-google-signin/google-signin` (v16) có mã native: sau khi cài / nâng nó phải build lại bằng
`npx expo run:android` (APK cũ mở JS mới sẽ báo thiếu module native). Không dùng plugin config của thư viện trong
`app.json` (không Firebase, chỉ Android): module tự liên kết (autolinking). Adapter nằm ở
`src/lib/googleSignInAdapter.ts`, được gắn một lần lúc khởi động ở `src/app/_layout.tsx`.

**Việc của người dùng** (tự đăng nhập Google Cloud Console; Claude không làm thay):
1. **OAuth consent screen** (External, chế độ Testing, thêm tài khoản Google dùng để thử vào Test users).
2. **Web client ID** (loại "Web application") → điền vào `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` trong `.env` của repo này **và** vào
   danh sách client ID Google của backend (tên biến ở `backend/.env.example`). Để trống thì nút Google báo "chưa cấu hình".
3. **Android client ID** (loại "Android"): package `com.taskly.app` + SHA-1 của debug keystore. Lấy SHA-1:
   `cd android; .gradlew signingReport` → dòng `SHA1:` dưới `Variant: debug`. Không dùng ở code, chỉ để Google chấp
   nhận chữ ký APK (thiếu → lỗi `DEVELOPER_ERROR`). Chạy `npx expo prebuild --clean` xong thì kiểm lại SHA-1.
4. Thêm một tài khoản Google vào emulator (Settings → Passwords & accounts), rồi chạy lại Metro: `npx expo start --dev-client -c`.

## Lệnh
| Việc | Lệnh |
|---|---|
| Build + cài app lên emulator | `npx expo run:android` |
| Chạy Metro cho development build | `npx expo start --dev-client` |
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

## Màn hình M1 (theo thiết kế `design-mobile/`)
Thanh tab dưới: **Inbox · Hôm nay · Sắp tới · Duyệt**; nút **+** góc dưới phải mở Quick Add (bottom sheet) đúng ngữ cảnh từng tab
(ẩn khi đang ở chế độ chọn nhiều, để không đè thanh thao tác). Duyệt: lối tắt, Yêu thích, Dự án của tôi (cây dự án con), Dự án đã lưu trữ,
Completed, tài khoản / Đăng xuất. Từ danh sách mở **màn dự án** (`/project/<id>`), **chi tiết task** (`/task/<id>`), **form dự án** (`/project-form`).

## Thư viện native thêm ở M1
`react-native-gesture-handler`, `react-native-reanimated` (+ `react-native-worklets`), `@react-native-community/datetimepicker`, `expo-crypto`, `expo-font`
(+ `@expo-google-fonts/figtree`), `@expo/vector-icons` (Feather), `react-native-draggable-flatlist` (JS). Sau khi kéo nhánh có M1 về, **build lại
development build một lần**: `npx expo run:android`, rồi chạy như thường `npx expo start --dev-client`.

## Quy ước code M1 (cho các mốc sau)
- Giao diện: chỉ dùng token ở `src/theme/` (màu `palette`, chữ `type` Figtree, `space` / `radius` / `size`); không viết mã màu rời. Thành phần dùng lại ở `src/components/`.
- Chữ hiển thị: mỗi tính năng một file `src/i18n/locales/vi/<ns>.json` (một key gốc `<ns>`), nối trong `src/i18n/index.ts`.
- Gọi API: `src/api/<resource>.ts`; model ở `src/api/models.ts`; ghi dữ liệu qua `useDataMutation` (chặn khi offline); lỗi qua `describeError` (theo `code` của ProblemDetail).
- Danh sách task: `usePagedList` / `useTaskList` + `TaskListView` (+ `taskRows` / `treeRows` / `sectionRow` / `nodeRow`).
- Thêm tab: file route trong `src/app/(app)/(tabs)/` + một phần tử trong `TAB_DEFS` (`src/features/navigation/navTabs.ts`). Thêm màn push: file route + một dòng `<Stack.Screen>` trong `src/app/(app)/_layout.tsx`.
- Browse: thêm khối vào `BROWSE_EXTRA_BLOCKS` (`src/features/browse/browseBlocks.ts`).
- Mọi request có timeout 15 giây (`DEFAULT_TIMEOUT_MS` trong `src/api/client.ts`).
- Cache task: sau `close` / `reopen` / `move` ghi câu trả lời vào cache bằng `applyTaskChange` (`src/api/taskCache.ts`) / `useMoveTask` — `version` chỉ đổi khi nội dung đổi, `reorder` thì không (dùng `useDataMutation(..., { keepDetail: true })`).
- `afterId`: vắng = cuối vùng chứa, `null` = đầu; `reorder` luôn gửi `afterId`. `id` UUID client là tuỳ chọn (M1–M8 không gửi; M9 dùng).
- Chỉ đọc: `isProjectReadOnly(project)`, `useTaskReadOnly(task)` / `useTaskAccess(task)` (`src/features/tasks/detail/taskReadOnly.ts`) — đã xong hoặc dự án / section lưu trữ.
- Chế độ chọn nhiều: `TaskSelectionProvider` là theo từng màn; nút + của tab layout biết chế độ này qua `useAnySelectionActive()` (`src/features/tasks/selectionActiveStore.ts`).
- Component dùng lại (chữ ký cố định cho M2–M5): `AppButton` (`variant` primary / danger / outline / ghost, `size` md / sm, `full`), `Chip` (`large` = 36), `Toggle({ value, onChange, label })`, `ListRow`, `RadioRow`, `BottomSheet` (`scroll` mặc định `true`).

## M1 — kịch bản demo trên emulator
**Chuẩn bị (người dùng tự chạy):**
1. Backend M1 (bản 3.1, DB đã migrate Flyway V2): `cd backend; docker compose up -d; .\mvnw spring-boot:run`.
2. Cửa sổ khác, trong thư mục `mobile`: `adb reverse tcp:8080 tcp:8080`, rồi `npx expo run:android` (lần đầu sau khi có M1 vì có thư viện native mới) hoặc
   `npx expo start --dev-client` (các lần sau).
3. **Người dùng tự đăng nhập / đăng ký** trên màn Đăng nhập của app (hoặc Swagger UI cho các bước 409 / 404); Claude và công cụ test không nhập mật khẩu.

**Ghi chú nút Tools của Expo (bản dev):** ở development build, Expo dev client vẽ một nút nổi **Tools** (mở menu dev: reload, Element Inspector, Performance
Monitor…) và nó nằm đè lên giao diện. Đó là công cụ của bản dev, không phải lỗi của app; bản release không có. Đừng nhầm nó với nút + của app; ẩn nó trong
menu dev (lắc máy / `Ctrl+M`) nếu che thao tác khi chụp màn hình.

**Các bước, mỗi mục báo Đạt / Không đạt:**
- **Đăng nhập & nền tảng:** bàn phím không che nút Đăng nhập; sau đăng ký vào Hôm nay, Back không về Đăng nhập; Duyệt → avatar → Đăng xuất về Đăng nhập; tắt backend → lỗi mạng trong ~15 giây.
- **Thêm việc (Quick Add):** nút + ở Inbox / Hôm nay / Sắp tới (chạm ngày 25 rồi +) / Duyệt mở sheet với chip dự án / ngày đúng; gõ tên, chọn Ngày mai + P1, Gửi → "Đã thêm vào Inbox", sheet vẫn mở để thêm tiếp; tên rỗng thì nút mờ, > 500 ký tự thì báo lỗi, không mất chữ.
- **Hoàn thành + Hoàn tác:** chạm ô tròn → toast "Đã hoàn thành 1 công việc · Hoàn tác" 5 giây; Hoàn tác → task về; hoàn thành task cha → con xong theo, Hoàn tác → mở lại đúng nhóm đó; vuốt phải = hoàn thành.
- **Đổi ngày:** vuốt trái → bộ chọn ngày → Ngày mai; chi tiết task → hàng Ngày (lối tắt, lịch, giờ, thời lượng, Bỏ giờ, Không có ngày); chip Hạn chót (ngày đã qua viền đỏ).
- **Chọn nhiều:** nhấn giữ một task → "1 đã chọn"; chọn thêm; **nút + biến mất, thanh dưới đủ 5 nút: Hoàn thành / Dời lịch / Ưu tiên / Chuyển / Xoá**; mỗi thao tác một lần cho cả nhóm; ✕ thoát và nút + hiện lại.
- **Sắp tới:** dải tuần (vuốt ngang, chạm ngày cuộn tới ngày đó, "Hôm nay" quay về, chọn tháng); cuộn cuối tải thêm 14 ngày; ngày trống có "Thêm công việc".
- **Dự án / section / sub-task:** Duyệt → Dự án của tôi → + (tên, mô tả, 20 màu, dự án cha, yêu thích), dự án con tới cấp 3; trong dự án thêm section, thêm task vào section, thu gọn bằng mũi tên, ⋯ section (Sửa, Sắp xếp, Lưu trữ, Xoá); sub-task tới cấp 4 (cấp 4 hết nút "Thêm sub-task"), tiến độ "0/2", Sao chép, Xoá có đếm sub-task.
- **Quá hạn:** tạo task hạn hôm qua + task hôm nay đã qua giờ → Hôm nay có khối **Quá hạn** (chỉ task hạn hôm qua; chữ đỏ) và nút **Dời lịch** (ngày trước hôm nay mờ); Dời lịch → Hôm nay / Ngày mai, toast "Đã dời N công việc"; hết việc → "Bạn đã xong hết việc hôm nay".
- **Lưu trữ / xoá dự án:** ⋯ dự án → Lưu trữ (không hỏi) → biến khỏi Duyệt; Duyệt → Dự án đã lưu trữ → mở (băng "chỉ xem được", không có +) → Khôi phục; ⋯ → Xoá dự án → hộp ghi đúng số dự án con + task đang mở → xoá hẳn (không có thùng rác). Section: Lưu trữ → task đang mở thành đã xong; Xoá → xoá luôn task.
- **Completed:** Duyệt → Completed, nhóm theo ngày hoàn thành, chip Từ ngày / Đến ngày, chạm ô tròn để mở lại.
- **Lỗi & mạng:** 409 (sửa task qua Swagger rồi sửa trong app → băng "Đã có thay đổi ở nơi khác"); 404 (xoá task qua Swagger khi đang mở → "Mục này không còn tồn tại"); tắt mạng emulator → banner "Bạn đang offline" ở trên cùng, nút ghi bị khoá, bật lại không tự gửi gì.
- **Đối chiếu thiết kế:** lề ngang 20, vùng chạm ≥ 44, FAB 56 cách phải 20 / cách đáy 100, chữ Figtree, màu ưu tiên P1 đỏ / P2 cam / P3 xanh dương / P4 xám.

Lỗi: dán log Metro / ảnh màn hình vào chat để sửa (mỗi lỗi một test + một commit).
## Màn hình M2
Tìm kiếm (tab `search`, mở từ biểu tượng kính lúp ở Browse): task, dự án, section, label, filter; "Tìm trong task đã
hoàn thành"; 5 từ khoá gần nhất (lưu trên máy). Browse → **Filters & Labels** (tạo / sửa / xoá, 20 màu, yêu thích,
nhấn giữ để mở menu, vuốt phải để yêu thích) và khối Labels; màn `label/[id]`, `filter/[id]`. Chọn label ở chi tiết
task, Quick Add (chip Labels) và chọn nhiều. **Display** (menu ⋯ → "Hiển thị" ở Today, Upcoming và dự án / Inbox; nút
thanh trượt ở label, filter) lưu theo tài khoản; Display không áp cho khối Quá hạn, màn Completed và "Completed tasks".

## Thư viện native thêm ở M2
Không có — **không cần build lại** development build sau khi kéo nhánh M2 (chỉ cần `npx expo start --dev-client`).

## Quy ước code M2 (cho các mốc sau)
- Màu: lấy từ `palette` của `src/theme` (token `taskly.css`); màu label / filter / dự án qua `projectColorHex`. Chữ: chỉ
  `type.*` (không `fontSize` / `fontWeight` rời).
- Danh sách task có Display: `useViewDisplay(viewKey)` → `{ params, options, ready, save, reset }`, đợi `ready` rồi gọi
  `useTaskList({ …, ...display.params })`; nhóm bằng `displayRows(tasks, groupBy, ctx)`. `tasksApi.list` tự bỏ tham số
  Display của `view=overdue` / `completed`.
- Chọn label: `LabelChip` (một chip, lưu khi bấm Xong) hoặc `LabelPickerSheet` (nhiều hành động).
- Mục tab mới: thêm khoá vào `NavTabKey` + `TAB_DEFS` (`SEARCH`, `FILTERS_LABELS` đã có — đúng tên giá trị `navTabs` của
  spec 12.1.1; M3 cho thêm vào thanh tab). Nhãn trong chi tiết task đi qua `TaskDraft.labelIds`.
- Kiểu API M2 (`Label`, `Filter`, `ViewOptions`, `labelIds`) hiện viết tay theo spec 12.7; `npm run gen:api` từ backend M2
  (Task 24) sẽ thay bằng kiểu sinh.
## Nhắc việc (M4)

- Nhắc **cục bộ** (chưa có push từ server — M13). Server tính sẵn thời điểm nhắc (`GET /api/v1/tasks/reminders`); app đặt
  **50** lần nhắc gần nhất trên máy, id lịch = `auto:<taskId>` hoặc id nhắc.
- Phần dùng thông báo của hệ điều hành đi qua **một cổng** `src/features/reminders/platform.ts` (`ReminderPlatform`: kênh,
  nút Hoãn / Hoàn thành, quyền, đặt / huỷ lịch, bấm thông báo). Mặc định là bản "không có" (không bao giờ có quyền) để
  logic chạy và test được không cần module native. Bản thật (`src/features/reminders/notifications.ts`, dùng
  `expo-notifications`) được `installReminderPlatform()` gắn **một lần** ở `src/app/_layout.tsx` lúc khởi động (kèm hiện
  banner khi app đang mở). Jest dùng mock `expo-notifications` trong `jest.setup.ts` + helper `src/test/notifications.ts`.
  `expo-notifications` là thay đổi native (plugin + quyền `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` trong `app.json`)
  nên phải build lại development build (`npx expo run:android`).
- **Nhắc tự động** cho task **có giờ** (Cài đặt → Nhắc nhở → Nhắc tự động, mặc định 30 phút trước, tắt được). Task chỉ có
  ngày không tự nhắc.
- **Nhắc riêng**: chip "Nhắc nhở" trong chi tiết task và Quick Add — thời điểm cụ thể, hoặc trước hạn (chỉ task có giờ).
  Task đã xong hoặc thuộc dự án / section lưu trữ: chỉ xem. Vuốt "Reminders" mở thẳng bảng nhắc của task.
- Đồng bộ lịch khi mở app, khi quay lại app, sau mỗi thao tác ghi thành công trên máy này, khi đổi cài đặt nhắc.
- Đăng xuất / hết phiên / đăng nhập tài khoản khác → huỷ mọi lịch nhắc.
- Giờ nhắc theo **múi giờ tài khoản** (không phải múi giờ máy). Android 14+ cần bật "Báo thức & lời nhắc" để nhắc đúng giờ (Cài đặt → Nhắc nhở hiện hướng dẫn cho tới khi hệ thống cho phép).
