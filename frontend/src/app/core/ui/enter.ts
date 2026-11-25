// Enter chỉ kích hoạt hành động chính khi con trỏ không ở textarea/select,
// không ở nút footer (Hủy/Lưu/Đóng) và không ở liên kết — các chỗ đó giữ phím mặc định
export function plainEnter(e: Event): boolean {
  if (e.defaultPrevented) return false;
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return false;
  return !el.closest('.p-dialog-footer, a');
}
