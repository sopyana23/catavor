<?php

namespace Database\Seeders;

use App\Models\Fauna;
use Illuminate\Database\Seeder;

class FaunaSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faunas = [
            [
                'name' => 'Ikan Arwana Super Red',
                'scientific_name' => 'Scleropages formosus',
                'class' => 'Ikan Hias',
                'habitat' => 'Air Tawar',
                'diet' => 'Karnivora (Jangkrik/Katak)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 5500000,
                'video_url' => 'https://www.youtube.com/watch?v=kYJjZ3xT0-U',
                'is_shipping_available' => true,
                'description' => 'Ikan Arwana Super Red berkualitas tinggi dengan warna merah yang cerah, proporsi tubuh yang sempurna, dayung panjang, dan mata tidak juling. Dilengkapi dengan microchip dan sertifikat resmi keaslian.',
                'image_url' => 'https://images.unsplash.com/photo-1524704654690-b56c05c78a02?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Kalimantan Barat, Indonesia',
                    'lifespan' => '15-20 tahun',
                    'weight' => '1-2 kg',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Arwana Super Red merupakan simbol keberuntungan dan kemakmuran bagi pemiliknya menurut feng shui.',
                        'Setiap ikan yang kami jual telah dipasang microchip steril di bawah kulitnya untuk pelacakan keaslian.'
                    ]
                ]
            ],
            [
                'name' => 'Ikan Cupang Halfmoon Red Dragon',
                'scientific_name' => 'Betta splendens',
                'class' => 'Ikan Hias',
                'habitat' => 'Air Tawar',
                'diet' => 'Omnivora (Jentik Nyamuk/Pelet)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 75000,
                'video_url' => 'https://www.youtube.com/watch?v=B7K04zO7N6M',
                'is_shipping_available' => true,
                'description' => 'Ikan Cupang Halfmoon dengan corak sisik naga putih (Red Dragon) yang sangat tebal kontras dengan ekor merah menyala. Sirip ekor lebar mengembang 180 derajat membentuk setengah lingkaran bulan sempurna saat mekrok.',
                'image_url' => 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Asia Tenggara',
                    'lifespan' => '2-3 tahun',
                    'weight' => '5-10 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Cupang memiliki organ labirin khusus yang memungkinkan mereka menghirup udara langsung dari permukaan air.',
                        'Corak sisik naga merupakan mutasi genetik yang menghasilkan lapisan metalik berkilau di atas warna dasar tubuhnya.'
                    ]
                ]
            ],
            [
                'name' => 'Sugar Glider Joey Classic Grey',
                'scientific_name' => 'Petaurus breviceps',
                'class' => 'Mamalia Kecil',
                'habitat' => 'Darat',
                'diet' => 'Omnivora (Bubur Bayi/Buah)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 350000,
                'video_url' => 'https://www.youtube.com/watch?v=zD_Yv36W3wU',
                'is_shipping_available' => false,
                'description' => 'Sugar Glider Joey (anak) varian Classic Grey umur 1.5 bulan. Karakter sangat jinak, tidak gigit, sudah mandiri belajar makan bubur, sehat walafiat tanpa cacat. Sangat cocok dipelihara untuk pemula yang ingin belajar melakukan bonding.',
                'image_url' => 'https://images.unsplash.com/photo-1607923432700-7a4c5f3f938f?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Papua & Australia',
                    'lifespan' => '10-12 tahun',
                    'weight' => '80-160 gram',
                    'shipping_coverage' => 'Ambil Sendiri di Toko (No Shipping)',
                    'fun_facts' => [
                        'Sugar Glider adalah hewan marsupial (memiliki kantung) dan termasuk hewan nokturnal yang aktif di malam hari.',
                        'Mereka dapat meluncur dari pohon ke pohon menggunakan patagium (selaput kulit tipis di antara kaki depan dan belakang).'
                    ]
                ]
            ],
            [
                'name' => 'Kucing Persia Medium Calico',
                'scientific_name' => 'Felis catus',
                'class' => 'Mamalia',
                'habitat' => 'Darat',
                'diet' => 'Karnivora (Makanan Kucing Basah/Kering)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 1200000,
                'video_url' => 'https://www.youtube.com/watch?v=Y1g0fB6a188',
                'is_shipping_available' => false,
                'description' => 'Anak Kucing Persia Medium dengan corak Calico (tiga warna keberuntungan) berumur 2.5 bulan. Bulu sangat lebat, gemuk, manja, sudah pandai buang air di litter box (bak pasir), serta sudah mendapatkan obat cacing rutin.',
                'image_url' => 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Persia (Iran)',
                    'lifespan' => '12-15 tahun',
                    'weight' => '3-5 kg',
                    'shipping_coverage' => 'Ambil Sendiri di Toko (No Shipping)',
                    'fun_facts' => [
                        'Kucing Calico hampir 99.9% dipastikan berjenis kelamin betina karena faktor gen kromosom X ganda.',
                        'Kucing persia terkenal dengan kepribadiannya yang tenang, lembut, dan lebih suka bersantai di sofa.'
                    ]
                ]
            ],
            [
                'name' => 'Landak Mini Albino Eksotis',
                'scientific_name' => 'Atelerix albiventris',
                'class' => 'Mamalia Kecil',
                'habitat' => 'Darat',
                'diet' => 'Insektivora (Ulat Hongkong/Cat Food)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 250000,
                'video_url' => 'https://www.youtube.com/watch?v=Gk6j89fK1u0',
                'is_shipping_available' => true,
                'description' => 'Landak Mini Albino dengan duri putih bersih dan mata merah eksotis yang mencolok. Berumur 2 bulan (siap adopsi), sehat tanpa kutu, lincah, tidak penakut, serta nafsu makan sangat tinggi (menyukai ulat hongkong kering maupun basah).',
                'image_url' => 'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Afrika Tengah',
                    'lifespan' => '4-6 tahun',
                    'weight' => '250-400 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Meskipun berduri tajam, duri landak mini tidak mengandung racun dan tidak bisa dilepaskan secara sengaja seperti landak hutan raksasa.',
                        'Ketika mencium bau baru yang menarik, mereka melakukan perilaku self-anointing (melumuri tubuh dengan air liur berbusa).'
                    ]
                ]
            ],
            [
                'name' => 'Ikan Discus Blue Diamond',
                'scientific_name' => 'Symphysodon aequifasciatus',
                'class' => 'Ikan Hias',
                'habitat' => 'Air Tawar',
                'diet' => 'Omnivora (Cacing Beku/Burger Jantung Sapi)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 180000,
                'video_url' => 'https://www.youtube.com/watch?v=11XJ62k4d8Q',
                'is_shipping_available' => true,
                'description' => 'Ikan Discus varietas Blue Diamond ukuran 3 inch. Warna biru solid mengkilap tanpa corak garis garis, bentuk tubuh bulat proporsional (round shape), sehat aktif, lincah, dan rakus makan cacing beku.',
                'image_url' => 'https://images.unsplash.com/photo-1534043464124-3be32fe000c9?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Sungai Amazon, Amerika Selatan',
                    'lifespan' => '10-15 tahun',
                    'weight' => '150-250 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Ikan Discus dikenal sebagai Raja Akuarium Air Tawar karena keindahan corak dan kemegahan bentuk tubuhnya.',
                        'Mereka menghasilkan cairan mukus (lendir) bergizi dari kulitnya untuk memberi makan anak-anaknya.'
                    ]
                ]
            ],
            [
                'name' => 'Kura-kura Sulcata Tortoise Baby',
                'scientific_name' => 'Centrochelys sulcata',
                'class' => 'Reptil',
                'habitat' => 'Darat',
                'diet' => 'Herbivora (Rumput/Sayuran Hijau/Pelet Mazuri)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 950000,
                'video_url' => 'https://www.youtube.com/watch?v=F_fO2w5K8gI',
                'is_shipping_available' => true,
                'description' => 'Baby Kura-kura Sulcata ukuran 5 cm hasil penangkaran resmi. Anatomi lengkap, kuku utuh, tempurung mulus (no pyramiding), sehat aktif, jalan tegap, dan rakus menyukai sayur fumak serta pelet Mazuri.',
                'image_url' => 'https://images.unsplash.com/photo-1548247416-ec66f4900b2e?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Gurun Sahara, Afrika',
                    'lifespan' => '70-150 tahun',
                    'weight' => '30-45 kg (dewasa)',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Sulcata adalah spesies kura-kura darat terbesar ketiga di dunia setelah Galapagos dan Aldabra.',
                        'Mereka menggali liang dalam tanah hingga kedalaman beberapa meter untuk berteduh dari suhu gurun yang ekstrem.'
                    ]
                ]
            ],
            [
                'name' => 'Gecko Tremper Albino',
                'scientific_name' => 'Eublepharis macularius',
                'class' => 'Reptil',
                'habitat' => 'Darat',
                'diet' => 'Karnivora/Insektivora (Jangkrik/Ulat Hongkong)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 150000,
                'video_url' => 'https://www.youtube.com/watch?v=e6oO3-n8i3E',
                'is_shipping_available' => true,
                'description' => 'Leopard Gecko varian Tremper Albino berumur 2.5 bulan. Pola totol kekuningan yang indah, ekor montok cadangan lemak sehat, kuku lengkap, kalsium rutin diberikan, karakter kalem (hand-feed ready).',
                'image_url' => 'https://images.unsplash.com/photo-1504450758481-7338eaa75e61?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Pakistan & India',
                    'lifespan' => '15-20 tahun',
                    'weight' => '50-80 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Leopard Gecko menyimpan cadangan makanan dan air di dalam ekornya yang tebal.',
                        'Berbeda dari cicak biasa, Leopard Gecko memiliki kelopak mata luar yang dapat digerakkan untuk berkedip.'
                    ]
                ]
            ],
            [
                'name' => 'Ikan Mas Koki Ranchu Show Grade',
                'scientific_name' => 'Carassius auratus',
                'class' => 'Ikan Hias',
                'habitat' => 'Air Tawar',
                'diet' => 'Omnivora (Cacing Sutra/Pelet Sinking)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 450000,
                'video_url' => 'https://www.youtube.com/watch?v=P_J4P7F-rCg',
                'is_shipping_available' => true,
                'description' => 'Ikan Mas Koki Ranchu kualitas Show Grade ukuran 10 cm. Memiliki jambul (wen) tebal rata, punggung melengkung mulus (smooth curve), ekor mekar rapi tanpa tulang patah, berenang seimbang.',
                'image_url' => 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Tiongkok & Jepang',
                    'lifespan' => '8-12 tahun',
                    'weight' => '100-300 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Ranchu sering dijuluki "Raja Mas Koki" di Jepang karena keunikan anatomi punggungnya yang tanpa sirip atas.',
                        'Jambul tebal (wen) pada Ranchu mulai tumbuh subur saat ikan memasuki usia satu tahun ke atas.'
                    ]
                ]
            ],
            [
                'name' => 'Kelinci Netherland Dwarf Purebred',
                'scientific_name' => 'Oryctolagus cuniculus',
                'class' => 'Mamalia Kecil',
                'habitat' => 'Darat',
                'diet' => 'Herbivora (Hay Rumput Kering/Pelet Kelinci)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 850000,
                'video_url' => 'https://www.youtube.com/watch?v=f_VpE-9dE3g',
                'is_shipping_available' => false,
                'description' => 'Kelinci Netherland Dwarf (ND) asli ras terkecil sedunia berumur 2 bulan. Telinga sangat pendek tegak rapat, kepala bulat pesek (bulldog face), bulu halus tebal variasi Chestnut. Sangat imut untuk dipelihara di dalam ruangan.',
                'image_url' => 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Belanda',
                    'lifespan' => '7-10 tahun',
                    'weight' => '0.8-1.2 kg (maksimal)',
                    'shipping_coverage' => 'Ambil Sendiri di Toko (No Shipping)',
                    'fun_facts' => [
                        'Netherland Dwarf adalah ras kelinci peliharaan terkecil di dunia yang tidak akan tumbuh besar melampaui ukuran lengannya.',
                        'Mereka memiliki metabolisme tinggi sehingga membutuhkan asupan rumput Timothy Hay segar secara berkelanjutan.'
                    ]
                ]
            ],
            [
                'name' => 'Hamster Winter White Pearl',
                'scientific_name' => 'Phodopus sungorus',
                'class' => 'Mamalia Kecil',
                'habitat' => 'Darat',
                'diet' => 'Omnivora (Biji-bijian/Millet/Kuaci)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 35000,
                'video_url' => 'https://www.youtube.com/watch?v=F_fO2w5K8gI',
                'is_shipping_available' => true,
                'description' => 'Hamster jenis Winter White varian Pearl umur 1.5 bulan. Bulu putih salju dengan garis abu-abu tipis di punggung, karakter ramah tidak suka menggigit, lincah, aktif bermain roda putar.',
                'image_url' => 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Siberia Barat & Kazakhstan',
                    'lifespan' => '2-3 tahun',
                    'weight' => '30-50 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Hamster Winter White dapat berubah warna bulu menjadi lebih putih ketika musim dingin untuk penyamaran di salju.',
                        'Mereka memiliki kantung pipi elastis yang sangat lebar untuk menimbun makanan dan dibawa ke liang.'
                    ]
                ]
            ],
            [
                'name' => 'Ular Ball Python Normal Baby',
                'scientific_name' => 'Python regius',
                'class' => 'Reptil',
                'habitat' => 'Darat',
                'diet' => 'Karnivora (Mencit Putih/Tikus Kecil)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 850000,
                'video_url' => 'https://www.youtube.com/watch?v=W55yQzYxX8Y',
                'is_shipping_available' => true,
                'description' => 'Baby Ular Ball Python varian morph Normal sehat mulus no cacat. Karakter pemalu, anteng, tidak berbisa sama sekali, sudah lulus test feeding tikus mencit hidup/mati 3 kali berturut-turut.',
                'image_url' => 'https://images.unsplash.com/photo-1531386151447-fd76ad50012f?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Afrika Tengah & Barat',
                    'lifespan' => '20-30 tahun',
                    'weight' => '1.2-2 kg (dewasa)',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Dinamakan "Ball Python" karena kebiasaan pertahanan diri mereka yang melingkar membentuk bola rapat ketika merasa takut.',
                        'Spesies ini merupakan jenis ular peliharaan terpopuler di dunia karena ukurannya yang relatif kecil dan karakternya yang sangat jinak.'
                    ]
                ]
            ],
            [
                'name' => 'Bearded Dragon Normal Morph',
                'scientific_name' => 'Pogona vitticeps',
                'class' => 'Reptil',
                'habitat' => 'Darat',
                'diet' => 'Omnivora (Jangkrik/Dubia/Sawi Hijau)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 650000,
                'video_url' => 'https://www.youtube.com/watch?v=f_VpE-9dE3g',
                'is_shipping_available' => true,
                'description' => 'Bearded Dragon baby ukuran 15 cm. Kuku ekor utuh mulus, lincah, rakus sayur wortel serut dan serangga kecil, jemur matahari teratur, siap dipelihara di kandang terarium gurun.',
                'image_url' => 'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Gurun Australia',
                    'lifespan' => '10-15 tahun',
                    'weight' => '250-500 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Mereka dapat menggembungkan duri di bawah dagunya yang akan menghitam menyerupai "janggut" untuk menakuti ancaman.',
                        'Bearded Dragon berkomunikasi secara sosial dengan melambaikan satu kaki depan (arm waving) atau mengangguk-angguk.'
                    ]
                ]
            ],
            [
                'name' => 'Ikan Channa Marulioides Yellow Sentarum',
                'scientific_name' => 'Channa marulioides',
                'class' => 'Ikan Hias',
                'habitat' => 'Air Tawar',
                'diet' => 'Karnivora (Udang Kering/Cacing Tanah/Katak Kecil)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 350000,
                'video_url' => 'https://www.youtube.com/watch?v=kYJjZ3xT0-U',
                'is_shipping_available' => true,
                'description' => 'Ikan Channa Marulioides varian Yellow Sentarum ukuran 18 cm. Mental juara, flaring cermin aktif, bar garis hitam tebal presisi, warna dasar kuning cerah mulai pecah merata di sisik tubuh.',
                'image_url' => 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80',
                'detailed_info' => [
                    'native_region' => 'Danau Sentarum, Kalimantan, Indonesia',
                    'lifespan' => '10-15 tahun',
                    'weight' => '500-1500 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Channa Maru merupakan predator air tawar endemik yang sangat teritorial dan agresif terhadap cermin.',
                        'Kualitas bar (garis vertikal) dipengaruhi oleh substrat pasir dan pencahayaan khusus di akuarium.'
                    ]
                ]
            ],
            [
                'name' => 'Kucing British Shorthair Grey Blue',
                'scientific_name' => 'Felis catus',
                'class' => 'Mamalia',
                'habitat' => 'Darat',
                'diet' => 'Karnivora (Makanan Premium Kucing)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 7500000,
                'video_url' => 'https://www.youtube.com/watch?v=Y1g0fB6a188',
                'is_shipping_available' => false,
                'description' => 'Anak Kucing ras British Shorthair (BSH) murni warna Grey Blue berumur 3 bulan. Bulu pendek sangat padat seperti boneka beruang (plush coat), mata bulat orange tembaga, vaksin pertama lengkap.',
                'image_url' => 'https://images.unsplash.com/photo-1574158622643-69d34d72650a?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Inggris',
                    'lifespan' => '12-17 tahun',
                    'weight' => '4-8 kg (dewasa)',
                    'shipping_coverage' => 'Ambil Sendiri di Toko (No Shipping)',
                    'fun_facts' => [
                        'British Shorthair merupakan salah satu ras kucing silsilah tertua yang diyakini dibawa oleh bangsa Romawi kuno.',
                        'Pipi tembam yang menggemaskan merupakan ciri khas utama pejantan ras ini saat beranjak dewasa.'
                    ]
                ]
            ],
            [
                'name' => 'Ikan Clownfish Nemo Biak Pearl',
                'scientific_name' => 'Amphiprion ocellaris',
                'class' => 'Ikan Hias',
                'habitat' => 'Air Laut',
                'diet' => 'Omnivora (Artemia/Pelet Laut Khusus)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 120000,
                'video_url' => 'https://www.youtube.com/watch?v=B7K04zO7N6M',
                'is_shipping_available' => true,
                'description' => 'Ikan Hias Clownfish Nemo berasal dari perairan Biak Papua, tangkaran lestari. Tubuh oranye cerah dengan list hitam tebal di pinggiran corak putih bersinar, sehat aktif berenang lincah.',
                'image_url' => 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Perairan Biak, Papua, Indonesia',
                    'lifespan' => '5-10 tahun',
                    'weight' => '20-50 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Clownfish hidup bersimbiosis mutualisme dengan anemon laut yang melindungi mereka dari sengatan predator lain.',
                        'Semua Clownfish dilahirkan sebagai jantan, dan yang terbesar dominan dalam kelompok akan berganti kelamin menjadi betina.'
                    ]
                ]
            ],
            [
                'name' => 'Ikan Blue Tang Dory Premium',
                'scientific_name' => 'Paracanthurus hepatus',
                'class' => 'Ikan Hias',
                'habitat' => 'Air Laut',
                'diet' => 'Herbivora/Alga (Pelet Mysis/Rumput Laut)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 280000,
                'video_url' => 'https://www.youtube.com/watch?v=B7K04zO7N6M',
                'is_shipping_available' => true,
                'description' => 'Ikan Blue Tang (Dory) air laut ukuran M (sekitar 7 cm). Warna biru pekat neon yang kontras dengan sirip ekor kuning mencolok, sudah karantina mandiri bebas penyakit ikan laut.',
                'image_url' => 'https://images.unsplash.com/photo-1534043464124-3be32fe000c9?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Samudra Hindia & Pasifik',
                    'lifespan' => '8-15 tahun',
                    'weight' => '80-150 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Blue Tang memiliki duri trivalen tajam di pangkal ekornya untuk perlindungan diri.',
                        'Ikan ini menjadi sangat populer secara global setelah karakter Dory muncul di film animasi populer.'
                    ]
                ]
            ],
            [
                'name' => 'Ikan Koi Kohaku Champion Import',
                'scientific_name' => 'Cyprinus carpio',
                'class' => 'Ikan Hias',
                'habitat' => 'Air Tawar',
                'diet' => 'Omnivora (Pelet Koi Spirulina/Ulat Sutra)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 1500000,
                'video_url' => 'https://www.youtube.com/watch?v=P_J4P7F-rCg',
                'is_shipping_available' => true,
                'description' => 'Ikan Koi Kohaku import Jepang ukuran 35 cm. Memiliki corak warna merah tebal (hi) berbatas tegas di atas dasar putih bersih (shiroji) tanpa bocor, tubuh proporsional torpedo shape.',
                'image_url' => 'https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Niigata, Jepang',
                    'lifespan' => '25-40 tahun',
                    'weight' => '1.5-3 kg',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Kohaku merupakan jenis koi tertua dan menjadi tolok ukur utama dalam penilaian kontes keindahan koi sedunia.',
                        'Koi legendaris bernama Hanako tercatat dapat bertahan hidup hingga usia menakjubkan 226 tahun.'
                    ]
                ]
            ],
            [
                'name' => 'Kura-kura Brazil Baby RES',
                'scientific_name' => 'Trachemys scripta elegans',
                'class' => 'Reptil',
                'habitat' => 'Air Tawar',
                'diet' => 'Omnivora (Pelet Kura-kura/Cacing/Ikan Mas Baby)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 45000,
                'video_url' => 'https://www.youtube.com/watch?v=F_fO2w5K8gI',
                'is_shipping_available' => true,
                'description' => 'Baby Kura-kura Brazil (Red Eared Slider) ukuran 3.5 cm. Garis telinga merah menyala tegas, tempurung hijau mulus mengkilap, lincah berenang aktif, sangat mudah dipelihara pemula.',
                'image_url' => 'https://images.unsplash.com/photo-1548247416-ec66f4900b2e?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Amerika Serikat Bagian Selatan',
                    'lifespan' => '20-30 tahun',
                    'weight' => '200-400 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Mereka dinamakan Red Eared Slider karena adanya bercak merah khas di belakang mata serta kemampuannya meluncur cepat ke air.',
                        'Spesies ini merupakan jenis kura-kura air tawar semi-akuatik yang paling banyak diternak di seluruh dunia.'
                    ]
                ]
            ],
            [
                'name' => 'Iguana Green El Salvador Baby',
                'scientific_name' => 'Iguana iguana',
                'class' => 'Reptil',
                'habitat' => 'Darat',
                'diet' => 'Herbivora (Sawi/Kangkung/Pepaya/Wortel)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 380000,
                'video_url' => 'https://www.youtube.com/watch?v=e6oO3-n8i3E',
                'is_shipping_available' => true,
                'description' => 'Baby Green Iguana varietas import El Salvador ukuran 25 cm (dari moncong hingga ekor). Warna hijau cerah stabil, duri spike utuh tegak rapat, karakter aktif gesit (siap handle bonding).',
                'image_url' => 'https://images.unsplash.com/photo-1504450758481-7338eaa75e61?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'El Salvador, Amerika Tengah',
                    'lifespan' => '12-15 tahun',
                    'weight' => '3-5 kg (dewasa)',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Iguana memiliki organ "mata ketiga" (parietal eye) di atas kepalanya yang berfungsi mendeteksi bayangan perubahan cahaya pemangsa.',
                        'Ekor panjang mereka yang kuat dapat digunakan sebagai senjata cambuk pertahanan yang menyakitkan.'
                    ]
                ]
            ],
            [
                'name' => 'Sugar Glider Joey Leucistic',
                'scientific_name' => 'Petaurus breviceps',
                'class' => 'Mamalia Kecil',
                'habitat' => 'Darat',
                'diet' => 'Omnivora (Bubur Bayi Instan/Buah Manis)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 1500000,
                'video_url' => 'https://www.youtube.com/watch?v=zD_Yv36W3wU',
                'is_shipping_available' => false,
                'description' => 'Sugar Glider Joey varian Leucistic berumur 2 bulan. Memiliki bulu putih mulus salju tanpa corak gelap dengan sepasang mata bulat hitam eksotis (bukan merah albino), jinak bonding.',
                'image_url' => 'https://images.unsplash.com/photo-1607923432700-7a4c5f3f938f?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Tangkaran Khusus Indonesia',
                    'lifespan' => '10-12 tahun',
                    'weight' => '90-150 gram',
                    'shipping_coverage' => 'Ambil Sendiri di Toko (No Shipping)',
                    'fun_facts' => [
                        'Warna putih leucistic dihasilkan dari mutasi genetik resesif murni yang membatasi pigmentasi melanin kulit.',
                        'Sugar glider sangat menyukai makanan berbau manis seperti nektar bunga, getah manis, dan sari buah.'
                    ]
                ]
            ],
            [
                'name' => 'Hamster Roborovski Agouti',
                'scientific_name' => 'Phodopus roborovskii',
                'class' => 'Mamalia Kecil',
                'habitat' => 'Darat',
                'diet' => 'Omnivora (Biji Hammie Mix/Millet)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 45000,
                'video_url' => 'https://www.youtube.com/watch?v=F_fO2w5K8gI',
                'is_shipping_available' => true,
                'description' => 'Hamster Roborovski Agouti umur 2 bulan. Ras hamster kerdil terkecil dan tergesit sedunia, sangat lincah berlari cepat, sehat menggemaskan, bulu cokelat muda dengan alis putih khas.',
                'image_url' => 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Gobi Desert, Mongolia & Tiongkok',
                    'lifespan' => '3-4 tahun',
                    'weight' => '20-25 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Roborovski merupakan ras hamster paling tahan banting yang dapat bertahan hidup di iklim gurun kering ekstrem.',
                        'Mereka dapat menempuh jarak lari hingga setara 4-5 kali keliling lapangan bola dalam satu malam di atas roda putar.'
                    ]
                ]
            ],
            [
                'name' => 'Ikan Louhan Cencu SRD F3',
                'scientific_name' => 'Amphilophus citrinellus',
                'class' => 'Ikan Hias',
                'habitat' => 'Air Tawar',
                'diet' => 'Karnivora (Pelet Udang Pelontar Jenong/Jangkrik)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 1250000,
                'video_url' => 'https://www.youtube.com/watch?v=kYJjZ3xT0-U',
                'is_shipping_available' => true,
                'description' => 'Ikan Louhan jenis Cencu Super Red Dragon (SRD) F3 ukuran 15 cm. Memiliki jenong boom air (kepala besar berair), mutiara corak cacing mengkilap seluruh tubuh, dan warna merah pekat di bagian dada depan.',
                'image_url' => 'https://images.unsplash.com/photo-1524704654690-b56c05c78a02?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Tangkaran Hibrida Malaysia & Indonesia',
                    'lifespan' => '8-10 tahun',
                    'weight' => '300-600 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Warna merah dan kilau mutiara pada louhan dipengaruhi oleh tingkat kecerahan substrat pasir dan keaktifan cermin flaring.',
                        'Bentuk dahinya yang menonjol diyakini membawa lambang panjang umur kemakmuran oleh sebagian pecinta ikan.'
                    ]
                ]
            ],
            [
                'name' => 'Kelinci Rex Carpet Brown Velvet',
                'scientific_name' => 'Oryctolagus cuniculus',
                'class' => 'Mamalia Kecil',
                'habitat' => 'Darat',
                'diet' => 'Herbivora (Rumput Alfalfa/Pelet Kelinci)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 450000,
                'video_url' => 'https://www.youtube.com/watch?v=f_VpE-9dE3g',
                'is_shipping_available' => false,
                'description' => 'Kelinci ras Rex bulu karpet warna cokelat Velvet berumur 2.5 bulan. Memiliki tekstur bulu yang sangat rapat tegak pendek menyerupai kain beludru halus premium, sehat lincah tanpa jamur kutu.',
                'image_url' => 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Prancis',
                    'lifespan' => '8-10 tahun',
                    'weight' => '2-3.5 kg (dewasa)',
                    'shipping_coverage' => 'Ambil Sendiri di Toko (No Shipping)',
                    'fun_facts' => [
                        'Kelinci Rex tidak memiliki rambut pelindung panjang di lapisan bulunya, sehingga teksturnya murni berbulu beludru.',
                        'Kumis kelinci Rex cenderung keriting dan bergelombang tipis akibat mutasi genetik unik ras ini.'
                    ]
                ]
            ],
            [
                'name' => 'Kucing Bengal Spotted Rosette',
                'scientific_name' => 'Felis catus',
                'class' => 'Mamalia',
                'habitat' => 'Darat',
                'diet' => 'Karnivora (Raw Food Daging Mentah Giling)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 9500000,
                'video_url' => 'https://www.youtube.com/watch?v=Y1g0fB6a188',
                'is_shipping_available' => false,
                'description' => 'Anak Kucing ras Bengal corak Spotted Rosette berumur 3 bulan. Corak pola bulat macan tutul yang sangat simetris dan kontras tajam, berkilau (glitter coat), sudah vaksin mandiri obat cacing rutin.',
                'image_url' => 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Amerika Serikat',
                    'lifespan' => '12-16 tahun',
                    'weight' => '4-7 kg (dewasa)',
                    'shipping_coverage' => 'Ambil Sendiri di Toko (No Shipping)',
                    'fun_facts' => [
                        'Kucing Bengal merupakan hasil hibrida persilangan antara Kucing Domestik dengan Kucing Macan Tutul Asia (ALC).',
                        'Berbeda dari kucing pada umumnya yang takut air, Bengal sangat menyukai air dan senang berenang atau bermain keran.'
                    ]
                ]
            ],
            [
                'name' => 'Ikan Guppy Albino Full Red (AFR)',
                'scientific_name' => 'Poecilia reticulata',
                'class' => 'Ikan Hias',
                'habitat' => 'Air Tawar',
                'diet' => 'Omnivora (Artemia/Pelet Mikro Bubuk)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 95000,
                'video_url' => 'https://www.youtube.com/watch?v=B7K04zO7N6M',
                'is_shipping_available' => true,
                'description' => 'Satu pasang (Pair) Ikan Guppy Albino Full Red (AFR) umur 3 bulan siap pijah breeding. Warna merah solid menutupi seluruh tubuh hingga sirip ekor lebar berumbai (wide tail), mata merah albino murni.',
                'image_url' => 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Tangkaran Khusus Indonesia',
                    'lifespan' => '1.5-2.5 tahun',
                    'weight' => '2-5 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Guppy AFR merupakan varietas mutasi genetik albino yang menekan pembentukan warna pigmen gelap melanin di kulit.',
                        'Jenis guppy ini termasuk hewan ovovivipar, di mana sang betina melahirkan anak-anak yang langsung berenang mandiri.'
                    ]
                ]
            ],
            [
                'name' => 'Landak Mini Salt and Pepper',
                'scientific_name' => 'Atelerix albiventris',
                'class' => 'Mamalia Kecil',
                'habitat' => 'Darat',
                'diet' => 'Insektivora (Ulat Hongkong/Pelet Landak Mini)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 195000,
                'video_url' => 'https://www.youtube.com/watch?v=Gk6j89fK1u0',
                'is_shipping_available' => true,
                'description' => 'Landak mini ras Salt and Pepper berumur 2.5 bulan. Memiliki duri dengan pola hitam putih kontras yang tebal teratur (pola alami klasik paling diminati), moncong kehitaman sehat lincah aman tanpa kutu.',
                'image_url' => 'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Afrika',
                    'lifespan' => '4-6 tahun',
                    'weight' => '250-380 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Warna Salt and Pepper merupakan warna klasik alami landak mini liar sebelum banyak diternakkan dengan aneka morph.',
                        'Landak mini memiliki sistem kekebalan tubuh yang tahan terhadap gigitan serangga berbisa rendah seperti kalajengking kecil.'
                    ]
                ]
            ],
            [
                'name' => 'Hamster Campbell Panda Morph',
                'scientific_name' => 'Phodopus campbelli',
                'class' => 'Mamalia Kecil',
                'habitat' => 'Darat',
                'diet' => 'Omnivora (Kuaci/Jagung Kering/Millet)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 25000,
                'video_url' => 'https://www.youtube.com/watch?v=F_fO2w5K8gI',
                'is_shipping_available' => true,
                'description' => 'Hamster Campbell varian corak Panda (hitam putih bercak tebal) umur 1.5 bulan. Pola warna tubuh yang menyerupai beruang panda raksasa, lincah, aktif bertenaga, sangat murah dipelihara.',
                'image_url' => 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Mongolia & Asia Timur',
                    'lifespan' => '2-2.5 tahun',
                    'weight' => '30-45 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Hamster Campbell memiliki watak yang sedikit lebih berani mempertahankan kawasannya dibandingkan Winter White.',
                        'Mereka dapat melahirkan anak dengan jumlah berkisar 4-10 ekor dalam satu masa kehamilan pendek.'
                    ]
                ]
            ],
            [
                'name' => 'Sugar Glider Joey White Face',
                'scientific_name' => 'Petaurus breviceps',
                'class' => 'Mamalia Kecil',
                'habitat' => 'Darat',
                'diet' => 'Omnivora (Bubur Bayi/Jangkrik Madu)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 650000,
                'video_url' => 'https://www.youtube.com/watch?v=zD_Yv36W3wU',
                'is_shipping_available' => false,
                'description' => 'Joey Sugar Glider varian White Face umur 2 bulan. Memiliki wajah putih bersih tanpa lingkar kacamata hitam di sekitar mata, karakter jinak siap latih bonding kantong (pouch training).',
                'image_url' => 'https://images.unsplash.com/photo-1607923432700-7a4c5f3f938f?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Papua & Kepulauan Halmahera',
                    'lifespan' => '10-12 tahun',
                    'weight' => '85-140 gram',
                    'shipping_coverage' => 'Ambil Sendiri di Toko (No Shipping)',
                    'fun_facts' => [
                        'Karakteristik wajah White Face dibedakan dengan tidak adanya pola garis hitam melintang dari telinga hingga pipi depan.',
                        'Mereka berkomunikasi dengan aneka suara unik seperti barking (gonggongan kecil) dan crabbing (suara berderik marah).'
                    ]
                ]
            ],
            [
                'name' => 'Ular Cornsnake Amel Motley Baby',
                'scientific_name' => 'Pantherophis guttatus',
                'class' => 'Reptil',
                'habitat' => 'Darat',
                'diet' => 'Karnivora (Baby Pinky Mouse Mencit)',
                'conservation_status' => 'Tersedia (For Sale)',
                'price' => 1100000,
                'video_url' => 'https://www.youtube.com/watch?v=W55yQzYxX8Y',
                'is_shipping_available' => true,
                'description' => 'Baby Ular Cornsnake varian Amelanistic Motley (warna merah-orange terang menyala tanpa pigmentasi hitam). Sangat jinak, gesit sedang, makan pinky tikus lancar 1 minggu sekali, cocok untuk pemula.',
                'image_url' => 'https://images.unsplash.com/photo-1531386151447-fd76ad50012f?auto=format&fit=crop&w=800&q=80',
                'detailed_info' => [
                    'native_region' => 'Amerika Serikat Bagian Tenggara',
                    'lifespan' => '15-20 tahun',
                    'weight' => '300-800 gram',
                    'shipping_coverage' => 'Bisa Kirim se-Indonesia',
                    'fun_facts' => [
                        'Cornsnake dinamai demikian karena mereka sering dijumpai di dekat gudang penyimpanan jagung tempat mencit tinggal.',
                        'Warna merah-orange menyala pada jenis Amel Motley tidak akan pudar seiring pertambahan usia ular.'
                    ]
                ]
            ]
        ];

        foreach ($faunas as $fauna) {
            Fauna::create([
                'name' => $fauna['name'],
                'scientific_name' => $fauna['scientific_name'],
                'class' => $fauna['class'],
                'habitat' => $fauna['habitat'],
                'diet' => $fauna['diet'],
                'conservation_status' => $fauna['conservation_status'],
                'price' => $fauna['price'],
                'video_url' => $fauna['video_url'],
                'is_shipping_available' => $fauna['is_shipping_available'],
                'description' => $fauna['description'],
                'image_url' => $fauna['image_url'],
                'detailed_info' => $fauna['detailed_info'],
            ]);
        }
    }
}
