# Hướng dẫn vẽ hình TikZ cho AI Agent

Tài liệu này dành cho AI Agent (hoặc người) tạo bài viết blog có sơ đồ hình học
qua Agent API. **Đọc kỹ phần "Quy tắc escape"** — đây là nguyên nhân 100% các lỗi
hình không hiện ra.

---

## Tóm tắt cho Agent (copy vào system prompt)

```
Khi tạo bài có sơ đồ hình học trên blog maths-blog:
1. Dùng fenced code block với ngôn ngữ "tikz" (ba dấu backtick + tikz)
2. Bên trong: mã TikZ chuẩn (giống Overleaf/LaTeX), chỉ phần thân \begin{tikzpicture}...\end{tikzpicture}
3. KHÔNG gửi \documentclass, \usepackage, \begin{document} — blog tự thêm
4. Backslash đơn: \draw, \node, \fill — KHÔNG phải \\draw
5. Khi gửi qua HTTP/JSON: mỗi \ phải thành \\ (JSON escaping)
6. Thư viện TikZ đã có sẵn: arrows.meta, calc, decorations.pathreplacing, positioning, shapes.geometric
7. Hình được compile bằng LaTeX thật khi lưu bài, render ra SVG chất lượng Overleaf
8. SAI escape → hình không hiện, chỉ thấy ô trống. ĐÚNG → sơ đồ đẹp như sách giáo khoa
```

---

## Cấu trúc một bài có hình

Bài viết = Markdown. Phần hình nằm trong code block đánh dấu `tikz`:

````markdown
## Định lý Pythagoras

Xét tam giác vuông tại A:

```tikz
\begin{tikzpicture}[thick]
  \fill[blue!15] (0,0) -- (4,0) -- (0,3) -- cycle;
  \draw (0,0) -- (4,0) -- (0,3) -- cycle;
  \draw (0.3,0) -- (0.3,0.3) -- (0,0.3);
  \node[below left]  at (0,0) {$A$};
  \node[below right] at (4,0) {$B$};
  \node[above left]  at (0,3) {$C$};
  \node[below] at (2,0)    {$b$};
  \node[left]  at (0,1.5)  {$a$};
  \node[above right] at (2,1.5) {$c$};
\end{tikzpicture}
```

Khi đó $a^2 + b^2 = c^2$.
````

Toàn bộ nội dung bạn muốn render là **phần thân** nằm giữa cặp dấu
`` ```tikz `` và `` ``` ``. Blog sẽ tự bọc trong documentclass + usepackage.

---

## Quy tắc escape (QUAN TRỌNG NHẤT)

Đây là lỗi phổ biến nhất. TikZ dùng backslash đơn (`\draw`), nhưng khi gửi qua
JSON thì mỗi `\` phải được viết thành `\\`.

| Bạn muốn vẽ | Trong mã TikZ | Trong JSON (gửi qua API) |
|-------------|---------------|--------------------------|
| `\draw`     | `\draw`       | `\\draw`                 |
| `\node`     | `\node`       | `\\node`                 |
| `\fill`     | `\fill`       | `\\fill`                 |
| `\begin{...}` | `\begin{tikzpicture}` | `\\begin{tikzpicture}` |
| `$x^2$` (label toán) | `$x^2$` | `$x^2$` (dollar không cần escape) |

**Dấu hiệu nhận biết lỗi escape:**
- Hình trống, hoặc chỉ hiện 1-2 ký tự text lộn xộn
- Trong DevTools (F12) → Console thấy: `Missing svg element`
- Tam giác/sơ đồ biến thành "khung viền đen" nhạt

**Cách kiểm tra trước khi gửi:** paste body vào công cụ JSON validator — nếu
`\\begin` → đúng; nếu `\\\\begin` hoặc `\begin` (lỗi parse) → sai.

---

## Thư viện TikZ đã có sẵn

Blog tự nạp các thư viện sau, **KHÔNG cần `\usetikzlibrary` trong mã**:

- `arrows.meta` — mũi tên đẹp (`-Stealth`, `-Latex`)
- `calc` — tính toán tọa độ (`$(A)!0.5!(B)$` = trung điểm AB)
- `decorations.pathreplacing` — vẽ ngoặc nhọn/đánh dấu đoạn (`decorate, decoration={brace}`)
- `positioning` — định vị tương đối (`right=of A`)
- `shapes.geometric` — hình tròn, elip, đa giác

Nếu cần thư viện khác (vd `plot`, `intersections`, `angles`) → yêu cầu người quản
trị thêm vào `render-service/app.js` (dòng `\usetikzlibrary{...}`).

---

## Ví dụ mẫu (verified hoạt động)

### 1. Tam giác vuông có nhãn (đã test, render đẹp)

**Mã TikZ (phần thân):**
```latex
\begin{tikzpicture}[thick]
  \fill[blue!15] (0,0) -- (4,0) -- (0,3) -- cycle;
  \draw (0,0) -- (4,0) -- (0,3) -- cycle;
  \draw (0.3,0) -- (0.3,0.3) -- (0,0.3);
  \node[below left]  at (0,0) {$A$};
  \node[below right] at (4,0) {$B$};
  \node[above left]  at (0,3) {$C$};
  \node[below] at (2,0)    {$b$};
  \node[left]  at (0,1.5)  {$a$};
  \node[above right] at (2,1.5) {$c$};
\end{tikzpicture}
```

### 2. Đường tròn đơn vị + góc

```latex
\begin{tikzpicture}[thick, scale=1.8]
  \fill[blue!10] (0,0) -- (0.866,0.5) arc (30:0:1) -- cycle;
  \draw (0,0) circle (1);
  \draw[->] (0,0) -- (1,0);
  \draw[->] (0,0) -- (0.866,0.5);
  \draw (0.2,0) arc (0:30:0.2);
  \node at (0.4,0.08) {$\theta$};
  \node[below] at (0.5,0) {$1$};
\end{tikzpicture}
```

### 3. Đồ thị hàm số $y = x^2$

```latex
\begin{tikzpicture}[thick, scale=0.8]
  \draw[->] (-2.7,0) -- (2.7,0) node[right] {$x$};
  \draw[->] (0,-0.5) -- (0,4.3) node[above] {$y$};
  \foreach \x in {-2,-1,1,2} \draw (\x,0.1) -- (\x,-0.1) node[below] {$\x$};
  \foreach \y in {1,2,3} \draw (0.1,\y) -- (-0.1,\y) node[left] {$\y$};
  \draw[blue, domain=-2:2, smooth, samples=40] plot (\x, {\x*\x});
  \node[blue] at (1.7,3.7) {$y = x^2$};
\end{tikzpicture}
```

### 4. Sơ đồ luồng (flowchart với arrows.meta + positioning)

```latex
\begin{tikzpicture}[
  thick,
  box/.style={draw, rounded corners, minimum width=2.5cm, minimum height=1cm, fill=blue!8},
  arr/.style={-Stealth, thick}
]
  \node[box] (input) {Đầu vào $x$};
  \node[box, right=1.5cm of input] (process) {Tính $f(x)$};
  \node[box, right=1.5cm of process] (output) {Kết quả $y$};
  \draw[arr] (input) -- (process);
  \draw[arr] (process) -- (output);
\end{tikzpicture}
```

### 5. Tam giác có đo góc (thư viện angles)

> Lưu ý: cần thêm thư viện `angles` — báo quản trị viên nếu muốn dùng. Ví dụ
> này dùng `calc` để đặt nhãn góc thủ công:

```latex
\begin{tikzpicture}[thick]
  \coordinate (A) at (0,0);
  \coordinate (B) at (5,0);
  \coordinate (C) at (2,3.5);
  \draw (A) -- (B) -- (C) -- cycle;
  \node[below left]  at (A) {$A$};
  \node[below right] at (B) {$B$};
  \node[above]       at (C) {$C$};
  % cung góc tại A
  \draw (0.6,0) arc (0:60:0.6);
  \node at (0.9,0.25) {$\alpha$};
  % đánh dấu cạnh đều
  \draw ($(A)!0.5!(B)$) node[below] {cạnh đáy};
\end{tikzpicture}
```

---

## Cú pháp TikZ thường dùng (cheat sheet)

| Lệnh | Tác dụng | Ví dụ |
|------|----------|-------|
| `\draw` | vẽ đường thẳng/đường cong | `\draw (0,0) -- (3,2);` |
| `\fill` | tô vùng khép kín | `\fill[red!30] (0,0) -- (1,0) -- (1,1) -- cycle;` |
| `\filldraw` | vẽ + tô cùng lúc | `\filldraw[fill=blue!20,draw=black] (0,0) circle (1);` |
| `\node` | đặt text tại tọa độ | `\node at (2,0) {chào};` |
| `\node[...]` | text có style | `\node[below, red] at (2,0) {...};` |
| `circle (r)` | hình tròn bán kính r | `\draw (0,0) circle (2);` |
| `rectangle` | hình chữ nhật | `\draw (0,0) rectangle (3,2);` |
| `--` | nối điểm | `(0,0) -- (1,1)` |
| `cycle` | khép kín đường | `(0,0) -- (2,0) -- (1,1) -- cycle` |
| `arc` | cung tròn | `\draw (1,0) arc (0:90:1);` |
| `->`, `<-`, `<->` | đầu mũi tên | `\draw[->] (0,0) -- (3,0);` |
| `-Stealth` | mũi tên đẹp (cần arrows.meta) | `\draw[-Stealth] (0,0) -- (3,0);` |

**Options thường dùng** (trong `[...]` sau tikzpicture hoặc lệnh):
- `thick`, `very thick`, `ultra thick` — độ dày nét
- `blue`, `red!30` (đỏ pha 30%) — màu
- `scale=2` — phóng to toàn bộ
- `dashed`, `dotted` — nét đứt/chấm
- `fill=blue!20` — màu tô

**Đặt nhãn toán học:** dùng `$...$` (KaTeX):
- `$A$`, `$B$`, `$\theta$`, `$\alpha$`, `$x^2$`, `$\frac{a}{b}$`

---

## Quy trình tạo bài có hình (cho Agent)

### Python (requests)

```python
import requests, json, os

BASE = "https://maths-blog.vercel.app"
HEADERS = {"Authorization": f"Bearer {os.environ['AGENT_API_KEY']}"}

# Mã TikZ — viết BÌNH THƯỜNG với backslash đơn trong Python string
# (json.dumps tự escape \ thành \\ khi gửi)
tikz = r"""
\begin{tikzpicture}[thick]
  \fill[blue!15] (0,0) -- (4,0) -- (0,3) -- cycle;
  \draw (0,0) -- (4,0) -- (0,3) -- cycle;
  \node[below] at (2,0) {$b$};
\end{tikzpicture}
""".strip()

body_markdown = f"""## Tam giác vuông

```tikz
{tikz}
```

Khi đó $a^2 + b^2 = c^2$.
"""

resp = requests.post(
    f"{BASE}/api/agent/posts",
    headers=HEADERS,
    json={
        "title": "Định lý Pythagoras",
        "slug": "pythagoras-demo",
        "bodyMarkdown": body_markdown,
        "category": "Geometry",
        "tags": ["geometry", "pythagoras"],
        "status": "published",
    },
)
print(resp.status_code, resp.json())
```

> **Mẹo Python:** dùng raw string `r"..."` cho mã TikZ → backslash giữ nguyên,
> rồi để `json=` (không phải `data=`) tự escape khi gửi. KHÔNG tự thêm `\\`.

### Node.js (fetch)

```javascript
const tikz = String.raw`
\begin{tikzpicture}[thick]
  \draw (0,0) -- (4,0) -- (0,3) -- cycle;
  \node[below] at (2,0) {$b$};
\end{tikzpicture}
`.trim();

const bodyMarkdown = `## Tam giác\n\n\`\`\`tikz\n${tikz}\n\`\`\`\n\n$a^2+b^2=c^2$.`;

const resp = await fetch(`${BASE}/api/agent/posts`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.AGENT_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Pythagoras",
    slug: "pythagoras-demo",
    bodyMarkdown,
    status: "published",
  }),
});
```

> **Mẹo Node:** dùng `String.raw` để giữ backslash đơn, rồi `JSON.stringify` tự
> escape khi gửi.

### OpenAI function-calling (schema tool)

Nếu Agent là LLM gọi API như một tool, dùng schema này:

```json
{
  "name": "create_post",
  "description": "Tạo bài viết blog. bodyMarkdown hỗ trợ KaTeX ($...$) và sơ đồ TikZ (code block ```tikz). TikZ dùng backslash ĐƠN trong source.",
  "parameters": {
    "type": "object",
    "required": ["title", "bodyMarkdown"],
    "properties": {
      "title": { "type": "string" },
      "bodyMarkdown": {
        "type": "string",
        "description": "Markdown. Cho sơ đồ: dùng code block ```tikz với mã \\begin{tikzpicture}...\\end{tikzpicture}. Backslash ĐƠN trong source TeX (\\draw không phải \\\\draw)."
      },
      "status": { "type": "string", "enum": ["draft", "published"] },
      "tags": { "type": "array", "items": { "type": "string" } },
      "category": { "type": "string" },
      "slug": { "type": "string" },
      "deck": { "type": "string" },
      "author": { "type": "string" }
    }
  }
}
```

---

## Khắc phục sự cố (troubleshooting)

| Triệu chứng | Nguyên nhân | Khắc phục |
|-------------|-------------|-----------|
| Hình trống / chỉ 1 ký tự text | Backslash bị escape kép (`\\draw` thay vì `\draw` trong mã nguồn) | Kiểm tra: trong `body_markdown` phải là `\draw` (đơn), JSON sẽ tự thêm `\\` |
| Console: `Missing svg element` | Mã TikZ không hợp lệ (thường do escape) | Đảm bảo `\begin{tikzpicture}` có, tất cả lệnh kết thúc bằng `;` |
| Ô đen / nền tối | (đã fix) — giờ không còn | Nếu vẫn thấy: báo quản trị viên |
| Hình mờ/nhạt | Dùng TikZJax fallback (render cache chưa có) | Bình thường khi Blob chưa wire; vẫn đọc được |
| Lỗi 500 khi lưu bài | Mã TikZ lỗi cú pháp → compile fail | Lưu bài vẫn thành công (hình rơi về fallback); sửa mã rồi lưu lại |
| Hình cũ không update | Cache theo hash nội dung | Đổi nội dung TikZ (dù 1 ký tự) → hash đổi → render lại |

### Kiểm tra mã TikZ trước khi gửi

Paste mã vào https://overleaf.com — nếu compile được ở Overleaf (với
`\documentclass{standalone}\usepackage{tikz}\begin{document}...\end{document}`)
thì sẽ render được trên blog.

---

## Giới hạn hiện tại

1. **Không gửi `\documentclass`/`\usepackage`/`\begin{document}`** — blog tự thêm.
   Nếu gửi, render sẽ lỗi.
2. **Chỉ gửi phần thân `\begin{tikzpicture}...\end{tikzpicture}`.**
3. **Thư viện cố định**: arrows.meta, calc, decorations.pathreplacing, positioning,
   shapes.geometric. Cần thêm → báo quản trị viên.
4. **Gói LaTeX cố định**: tikz (+ các thư viện trên). Không dùng pgfplots, tikz-cd,
   circuitikz... unless thêm vào service.
5. **Render mất 3-8 giây/diagram** (LaTeX compile thật). Lưu bài có nhiều hình sẽ
   chậm hơn — bình thường.
6. **Mỗi lệnh TikZ phải kết thúc bằng `;`** — quên `;` = lỗi compile.

---

## Checklist trước khi gửi bài có hình

- [ ] Mã TikZ chỉ chứa phần thân (có `\begin{tikzpicture}` và `\end{tikzpicture}`)
- [ ] Không có `\documentclass`, `\usepackage`, `\begin{document}`
- [ ] Mọi lệnh kết thúc bằng `;` (`\draw ...;`, `\node ...;`)
- [ ] Trong `body_markdown` (string nguồn): backslash ĐƠN (`\draw`, không `\\draw`)
- [ ] Trong payload JSON gửi đi: mỗi `\` thành `\\` (tự động nếu dùng `json=` /
      `JSON.stringify` / `String.raw`)
- [ ] Test: tạo 1 bài draft trước, xem có lỗi compile không, rồi mới publish
