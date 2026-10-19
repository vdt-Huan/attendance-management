# BÁO CÁO — BIỂU ĐỒ CHẤM CÔNG 7 NGÀY (Ngày 7.3.5)

## 1. Thay đổi

- `src/services/attendanceHistory.ts`: thêm `AttendanceDayCount` và `getAttendanceLast7Days(departmentId?)` (aggregate theo 7 ngày gần nhất, timezone VN).
- `src/components/AttendanceWeekChart.tsx`: biểu đồ cột CSS (stacked) + empty/error state + legend.
- `src/pages/DashboardPage.tsx`: biểu đồ 7 ngày cho HR/Admin.
- `src/pages/EmployeeDashboardPage.tsx`: biểu đồ 7 ngày cho nhân viên (RLS giới hạn dữ liệu của mình).

## 2. SQL đối chiếu

```sql
select work_date, status, count(*) as total
from attendance_records
where work_date between (vn_today() - interval '6 days')::date and vn_today()
group by work_date, status
order by work_date;
```

## 3. Kiểm thử

- `npm run lint`: PASS (0 errors).
- `npm run build`: PASS.

## 4. Ghi chú

- Không cần migration.
- Employee chỉ thấy dữ liệu của mình nhờ RLS.
