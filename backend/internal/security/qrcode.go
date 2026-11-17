package security

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
)

// ErrQRPayloadTooLarge dikembalikan apabila teks melampaui kapasitas maksimum
// QR Code versi 12 EC Level M (290 byte pada Byte Mode).
var ErrQRPayloadTooLarge = errors.New("security: payload QR melebihi batas maksimum")

type qrVersionSpec struct {
	version       int
	totalCw       int
	ecCwPerBlock  int
	group1Blocks  int
	group1DataCw  int
	group2Blocks  int
	group2DataCw  int
	alignCenters  []int
}

// Tabel parameter ISO/IEC 18004 untuk Error Correction Level M (15% recovery),
// mencakup Versi 1 s/d 12 (kapasitas Byte Mode hingga 287 byte).
var qrLevelMSpecs = []qrVersionSpec{
	{1, 26, 10, 1, 16, 0, 0, nil},
	{2, 44, 16, 1, 28, 0, 0, []int{6, 18}},
	{3, 70, 26, 1, 44, 0, 0, []int{6, 22}},
	{4, 100, 18, 2, 32, 0, 0, []int{6, 26}},
	{5, 134, 24, 2, 43, 0, 0, []int{6, 30}},
	{6, 172, 16, 4, 27, 0, 0, []int{6, 34}},
	{7, 196, 18, 4, 31, 0, 0, []int{6, 22, 38}},
	{8, 242, 22, 2, 38, 2, 39, []int{6, 24, 42}},
	{9, 292, 22, 3, 36, 2, 37, []int{6, 26, 46}},
	{10, 346, 26, 4, 43, 1, 44, []int{6, 28, 50}},
	{11, 404, 30, 1, 50, 4, 51, []int{6, 30, 54}},
	{12, 466, 22, 6, 36, 2, 37, []int{6, 32, 58}},
}

func (s qrVersionSpec) dataCodewords() int {
	return s.group1Blocks*s.group1DataCw + s.group2Blocks*s.group2DataCw
}

func (s qrVersionSpec) charCountBits() int {
	if s.version <= 9 {
		return 8
	}
	return 16
}

// GenerateQRCodeSVG menghasilkan markup SVG persegi tajam (crispEdges) berbasis
// standar ISO/IEC 18004 (Byte Mode, Error Correction Level M) murni dengan Go
// standard library tanpa dependensi eksternal maupun panggilan jaringan keluar.
func GenerateQRCodeSVG(content string, borderModules int) (string, error) {
	matrix, err := EncodeQRMatrix([]byte(content))
	if err != nil {
		return "", err
	}
	if borderModules < 2 {
		borderModules = 4
	}
	size := len(matrix)
	total := size + borderModules*2

	var buf bytes.Buffer
	buf.Grow(4096)
	buf.WriteString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 `)
	buf.WriteString(strconv.Itoa(total))
	buf.WriteByte(' ')
	buf.WriteString(strconv.Itoa(total))
	buf.WriteString(`" shape-rendering="crispEdges" role="img" aria-label="QR Code Authenticator">`)
	buf.WriteString(`<rect width="100%" height="100%" fill="#ffffff"/>`)
	buf.WriteString(`<path fill="#0f172a" d="`)
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			if matrix[y][x] {
				buf.WriteByte('M')
				buf.WriteString(strconv.Itoa(x + borderModules))
				buf.WriteByte(',')
				buf.WriteString(strconv.Itoa(y + borderModules))
				buf.WriteString("h1v1h-1z")
			}
		}
	}
	buf.WriteString(`"/></svg>`)
	return buf.String(), nil
}

// GenerateQRCodeDataURL mengemas SVG QR Code ke dalam URI data:image/svg+xml;base64
// agar dapat dirender langsung pada elemen <img> tanpa dangerouslySetInnerHTML.
func GenerateQRCodeDataURL(content string) (string, error) {
	svg, err := GenerateQRCodeSVG(content, 4)
	if err != nil {
		return "", err
	}
	return "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte(svg)), nil
}

// EncodeQRMatrix mengodekan byte ke matriks modul gelap/terang QR Code (ISO/IEC 18004).
func EncodeQRMatrix(payload []byte) ([][]bool, error) {
	var spec qrVersionSpec
	found := false
	for _, candidate := range qrLevelMSpecs {
		neededBits := 4 + candidate.charCountBits() + len(payload)*8
		if neededBits <= candidate.dataCodewords()*8 {
			spec = candidate
			found = true
			break
		}
	}
	if !found {
		return nil, ErrQRPayloadTooLarge
	}

	dataCw := buildQRDataCodewords(payload, spec)
	allCw := interleaveQRBlocks(dataCw, spec)

	size := 17 + 4*spec.version
	baseGrid := make([][]bool, size)
	isFunc := make([][]bool, size)
	for i := 0; i < size; i++ {
		baseGrid[i] = make([]bool, size)
		isFunc[i] = make([]bool, size)
	}

	drawQRFunctionPatterns(baseGrid, isFunc, spec)
	if err := placeQRCodewords(baseGrid, isFunc, allCw); err != nil {
		return nil, err
	}

	var bestGrid [][]bool
	bestPenalty := int(^uint(0) >> 1)

	for mask := 0; mask < 8; mask++ {
		trial := cloneQRGrid(baseGrid)
		applyQRMask(trial, isFunc, mask)
		drawQRFormatBits(trial, isFunc, mask)
		penalty := scoreQRMaskPenalty(trial)
		if penalty < bestPenalty {
			bestPenalty = penalty
			bestGrid = trial
		}
	}
	return bestGrid, nil
}

type bitBuffer struct {
	data []byte
	bits int
}

func (b *bitBuffer) appendBits(val uint32, length int) {
	for i := length - 1; i >= 0; i-- {
		if b.bits%8 == 0 {
			b.data = append(b.data, 0)
		}
		if ((val >> uint(i)) & 1) != 0 {
			b.data[b.bits/8] |= 1 << uint(7-(b.bits%8))
		}
		b.bits++
	}
}

func buildQRDataCodewords(payload []byte, spec qrVersionSpec) []byte {
	capacityBits := spec.dataCodewords() * 8
	var bb bitBuffer
	// Byte mode indicator: 0100 (4 bits)
	bb.appendBits(0x4, 4)
	bb.appendBits(uint32(len(payload)), spec.charCountBits())
	for _, b := range payload {
		bb.appendBits(uint32(b), 8)
	}
	// Terminator hingga 4 bit nol
	term := 4
	if rem := capacityBits - bb.bits; rem < term {
		term = rem
	}
	bb.appendBits(0, term)
	// Rata batas byte
	if padBits := (8 - (bb.bits % 8)) % 8; padBits > 0 {
		bb.appendBits(0, padBits)
	}
	// Pad byte bergantian 0xEC dan 0x11
	padBytes := [2]byte{0xEC, 0x11}
	idx := 0
	for len(bb.data) < spec.dataCodewords() {
		bb.appendBits(uint32(padBytes[idx%2]), 8)
		idx++
	}
	return bb.data
}

func interleaveQRBlocks(data []byte, spec qrVersionSpec) []byte {
	totalBlocks := spec.group1Blocks + spec.group2Blocks
	dataBlocks := make([][]byte, 0, totalBlocks)
	ecBlocks := make([][]byte, 0, totalBlocks)
	gen := rsGeneratorPoly(spec.ecCwPerBlock)

	offset := 0
	for i := 0; i < spec.group1Blocks; i++ {
		blk := data[offset : offset+spec.group1DataCw]
		offset += spec.group1DataCw
		dataBlocks = append(dataBlocks, blk)
		ecBlocks = append(ecBlocks, rsComputeRemainder(blk, gen))
	}
	for i := 0; i < spec.group2Blocks; i++ {
		blk := data[offset : offset+spec.group2DataCw]
		offset += spec.group2DataCw
		dataBlocks = append(dataBlocks, blk)
		ecBlocks = append(ecBlocks, rsComputeRemainder(blk, gen))
	}

	maxDataLen := spec.group1DataCw
	if spec.group2DataCw > maxDataLen {
		maxDataLen = spec.group2DataCw
	}

	out := make([]byte, 0, spec.totalCw)
	for col := 0; col < maxDataLen; col++ {
		for _, blk := range dataBlocks {
			if col < len(blk) {
				out = append(out, blk[col])
			}
		}
	}
	for col := 0; col < spec.ecCwPerBlock; col++ {
		for _, ec := range ecBlocks {
			out = append(out, ec[col])
		}
	}
	return out
}

func gfMul(x, y byte) byte {
	var z byte
	for i := 7; i >= 0; i-- {
		z = (z << 1) ^ ((z >> 7) * 0x1D)
		if ((y >> uint(i)) & 1) != 0 {
			z ^= x
		}
	}
	return z
}

func rsGeneratorPoly(degree int) []byte {
	poly := make([]byte, degree)
	poly[degree-1] = 1
	root := byte(1)
	for i := 0; i < degree; i++ {
		for j := 0; j < degree; j++ {
			poly[j] = gfMul(poly[j], root)
			if j+1 < degree {
				poly[j] ^= poly[j+1]
			}
		}
		root = gfMul(root, 0x02)
	}
	return poly
}

func rsComputeRemainder(data, gen []byte) []byte {
	rem := make([]byte, len(gen))
	for _, b := range data {
		factor := b ^ rem[0]
		copy(rem, rem[1:])
		rem[len(rem)-1] = 0
		for j, coef := range gen {
			rem[j] ^= gfMul(coef, factor)
		}
	}
	return rem
}

func setFuncModule(grid, isFunc [][]bool, x, y int, dark bool) {
	grid[y][x] = dark
	isFunc[y][x] = true
}

func drawQRFunctionPatterns(grid, isFunc [][]bool, spec qrVersionSpec) {
	size := len(grid)

	// Timing patterns
	for i := 0; i < size; i++ {
		setFuncModule(grid, isFunc, 6, i, i%2 == 0)
		setFuncModule(grid, isFunc, i, 6, i%2 == 0)
	}

	// 3 Finder patterns + separator putih
	drawFinder := func(cx, cy int) {
		for dy := -4; dy <= 4; dy++ {
			for dx := -4; dx <= 4; dx++ {
				xx, yy := cx+dx, cy+dy
				if xx < 0 || xx >= size || yy < 0 || yy >= size {
					continue
				}
				dist := absInt(dx)
				if absInt(dy) > dist {
					dist = absInt(dy)
				}
				dark := dist != 2 && dist != 4
				setFuncModule(grid, isFunc, xx, yy, dark)
			}
		}
	}
	drawFinder(3, 3)
	drawFinder(size-4, 3)
	drawFinder(3, size-4)

	// Alignment patterns
	nAlign := len(spec.alignCenters)
	for i := 0; i < nAlign; i++ {
		for j := 0; j < nAlign; j++ {
			if (i == 0 && j == 0) || (i == 0 && j == nAlign-1) || (i == nAlign-1 && j == 0) {
				continue
			}
			cx, cy := spec.alignCenters[i], spec.alignCenters[j]
			for dy := -2; dy <= 2; dy++ {
				for dx := -2; dx <= 2; dx++ {
					dist := absInt(dx)
					if absInt(dy) > dist {
						dist = absInt(dy)
					}
					setFuncModule(grid, isFunc, cx+dx, cy+dy, dist != 1)
				}
			}
		}
	}

	// Reservasi slot format bits + dark module terlebih dahulu
	drawQRFormatBits(grid, isFunc, 0)

	// Version info untuk V >= 7
	if spec.version >= 7 {
		rem := spec.version
		for i := 0; i < 12; i++ {
			rem = (rem << 1) ^ ((rem >> 11) * 0x1F25)
		}
		bits := (spec.version << 12) | rem
		for i := 0; i < 18; i++ {
			dark := ((bits >> uint(i)) & 1) != 0
			a := size - 11 + i%3
			b := i / 3
			setFuncModule(grid, isFunc, a, b, dark)
			setFuncModule(grid, isFunc, b, a, dark)
		}
	}
}

func drawQRFormatBits(grid, isFunc [][]bool, mask int) {
	size := len(grid)
	// EC Level M memiliki indikator 2-bit = 00 (0)
	data := (0 << 3) | mask
	rem := data
	for i := 0; i < 10; i++ {
		rem = (rem << 1) ^ ((rem >> 9) * 0x537)
	}
	bits := ((data << 10) | rem) ^ 0x5412

	getBit := func(idx int) bool {
		return ((bits >> uint(idx)) & 1) != 0
	}

	// Salinan pertama di sekitar finder kiri-atas
	for i := 0; i <= 5; i++ {
		setFuncModule(grid, isFunc, 8, i, getBit(i))
	}
	setFuncModule(grid, isFunc, 8, 7, getBit(6))
	setFuncModule(grid, isFunc, 8, 8, getBit(7))
	setFuncModule(grid, isFunc, 7, 8, getBit(8))
	for i := 9; i < 15; i++ {
		setFuncModule(grid, isFunc, 14-i, 8, getBit(i))
	}

	// Salinan kedua di kanan-atas & kiri-bawah
	for i := 0; i < 8; i++ {
		setFuncModule(grid, isFunc, size-1-i, 8, getBit(i))
	}
	for i := 8; i < 15; i++ {
		setFuncModule(grid, isFunc, 8, size-15+i, getBit(i))
	}
	// Dark module tetap
	setFuncModule(grid, isFunc, 8, size-8, true)
}

func placeQRCodewords(grid, isFunc [][]bool, codewords []byte) error {
	size := len(grid)
	bitIdx := 0
	totalBits := len(codewords) * 8

	for right := size - 1; right >= 1; right -= 2 {
		if right == 6 {
			right = 5
		}
		upward := ((right + 1) & 2) == 0
		for vert := 0; vert < size; vert++ {
			y := vert
			if upward {
				y = size - 1 - vert
			}
			for j := 0; j < 2; j++ {
				x := right - j
				if isFunc[y][x] {
					continue
				}
				dark := false
				if bitIdx < totalBits {
					dark = ((codewords[bitIdx/8] >> uint(7-(bitIdx%8))) & 1) != 0
					bitIdx++
				}
				grid[y][x] = dark
			}
		}
	}
	if bitIdx != totalBits {
		return fmt.Errorf("security: penempatan bit QR tidak presisi (%d dari %d)", bitIdx, totalBits)
	}
	return nil
}

func applyQRMask(grid, isFunc [][]bool, mask int) {
	size := len(grid)
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			if isFunc[y][x] {
				continue
			}
			var invert bool
			switch mask {
			case 0:
				invert = (x+y)%2 == 0
			case 1:
				invert = y%2 == 0
			case 2:
				invert = x%3 == 0
			case 3:
				invert = (x+y)%3 == 0
			case 4:
				invert = (y/2+x/3)%2 == 0
			case 5:
				invert = (x*y)%2+(x*y)%3 == 0
			case 6:
				invert = ((x*y)%2+(x*y)%3)%2 == 0
			case 7:
				invert = ((x+y)%2+(x*y)%3)%2 == 0
			}
			if invert {
				grid[y][x] = !grid[y][x]
			}
		}
	}
}

func scoreQRMaskPenalty(grid [][]bool) int {
	size := len(grid)
	penalty := 0

	// N1: 5+ modul berurutan sewarna pada baris & kolom
	for y := 0; y < size; y++ {
		runColor := grid[y][0]
		runLen := 1
		for x := 1; x < size; x++ {
			if grid[y][x] == runColor {
				runLen++
				if runLen == 5 {
					penalty += 3
				} else if runLen > 5 {
					penalty++
				}
			} else {
				runColor = grid[y][x]
				runLen = 1
			}
		}
	}
	for x := 0; x < size; x++ {
		runColor := grid[0][x]
		runLen := 1
		for y := 1; y < size; y++ {
			if grid[y][x] == runColor {
				runLen++
				if runLen == 5 {
					penalty += 3
				} else if runLen > 5 {
					penalty++
				}
			} else {
				runColor = grid[y][x]
				runLen = 1
			}
		}
	}

	// N2: blok 2x2 sewarna
	for y := 0; y < size-1; y++ {
		for x := 0; x < size-1; x++ {
			c := grid[y][x]
			if grid[y][x+1] == c && grid[y+1][x] == c && grid[y+1][x+1] == c {
				penalty += 3
			}
		}
	}

	// N3: pola mirip finder 1:1:3:1:1 dengan 4 modul terang di salah satu sisi
	linePenalty := func(get func(i int) bool) int {
		p := 0
		for i := 0; i <= size-11; i++ {
			// 10111010000
			if get(i) && !get(i+1) && get(i+2) && get(i+3) && get(i+4) && !get(i+5) && get(i+6) &&
				!get(i+7) && !get(i+8) && !get(i+9) && !get(i+10) {
				p += 40
			}
			// 00001011101
			if !get(i) && !get(i+1) && !get(i+2) && !get(i+3) && get(i+4) && !get(i+5) &&
				get(i+6) && get(i+7) && get(i+8) && !get(i+9) && get(i+10) {
				p += 40
			}
		}
		return p
	}
	for y := 0; y < size; y++ {
		row := y
		penalty += linePenalty(func(i int) bool { return grid[row][i] })
	}
	for x := 0; x < size; x++ {
		col := x
		penalty += linePenalty(func(i int) bool { return grid[i][col] })
	}

	// N4: keseimbangan rasio gelap vs terang
	dark := 0
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			if grid[y][x] {
				dark++
			}
		}
	}
	total := size * size
	k := (absInt(dark*20-total*10) + total - 1) / total
	if k > 0 {
		penalty += (k - 1) * 10
	}
	return penalty
}

func cloneQRGrid(src [][]bool) [][]bool {
	dst := make([][]bool, len(src))
	for i := range src {
		dst[i] = make([]bool, len(src[i]))
		copy(dst[i], src[i])
	}
	return dst
}

func absInt(v int) int {
	if v < 0 {
		return -v
	}
	return v
}
