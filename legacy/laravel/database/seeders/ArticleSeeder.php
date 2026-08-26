<?php

namespace Database\Seeders;

use App\Models\Article;
use Illuminate\Database\Seeder;

class ArticleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $articles = [
            [
                'title' => 'Panduan Memelihara Sugar Glider untuk Pemula',
                'content' => "Sugar Glider (Petaurus breviceps) adalah hewan marsupial kecil yang sangat populer dipelihara. Untuk memeliharanya bagi pemula, Anda membutuhkan kandang yang cukup tinggi karena mereka suka memanjat dan meluncur. Makanan utama untuk joey berumur di bawah 4 bulan adalah bubur bayi instan rendah gula yang dicampur dengan suplemen kalsium khusus sugar glider. Berikan buah-buahan manis seperti pepaya, melon, atau apel sebagai selingan.\n\nKunci keberhasilan memelihara sugar glider adalah ikatan (bonding) yang kuat. Seringlah mengajak mereka berinteraksi dengan menaruhnya di dalam bonding pouch (kantung bonding) saat Anda beraktivitas santai di rumah.",
                'image_url' => 'https://images.unsplash.com/photo-1607923432700-7a4c5f3f938f?auto=format&fit=crop&w=800&q=80',
                'author' => 'Tim Ahli DFauna',
                'read_time' => '5 mnt baca'
            ],
            [
                'title' => 'Menjaga Kualitas Air Ideal Akuarium Ikan Discus',
                'content' => "Ikan Discus dikenal sebagai Raja Akuarium Air Tawar karena bentuk tubuhnya yang anggun dan warnanya yang memukau. Namun, ikan ini terkenal sangat sensitif terhadap perubahan parameter air. Suhu ideal untuk memelihara ikan discus berkisar antara 28-31 derajat Celsius.\n\nKadar pH air harus dijaga agar tetap stabil di rentang asam hingga netral, yaitu sekitar 6.0 - 7.0. Penggantian air rutin sebanyak 20-30% setiap 2-3 hari sekali sangat disarankan untuk menjaga kebersihan akuarium dan menekan kadar amonia serta nitrat.",
                'image_url' => 'https://images.unsplash.com/photo-1534043464124-3be32fe000c9?auto=format&fit=crop&w=800&q=80',
                'author' => 'Aquascaper Pro',
                'read_time' => '4 mnt baca'
            ],
            [
                'title' => 'Mengenal Perilaku Unik Landak Mini Albino',
                'content' => "Landak Mini Albino dengan duri putih bersih dan mata merah eksotis memiliki perilaku unik yang disebut self-anointing. Ketika landak mini mencium bau baru yang kuat atau asing, mereka akan mulai mengunyah benda tersebut hingga air liurnya berbusa, lalu memutar tubuhnya untuk melumurkan busa tersebut ke duri-durinya.\n\nIni adalah mekanisme pertahanan diri alami untuk menyamarkan bau tubuh mereka di habitat aslinya. Untuk melatih agar landak mini tidak mudah menggulung saat disentuh, biasakan menaruh kaos bekas dengan bau tubuh Anda di dalam kandangnya.",
                'image_url' => 'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=800&q=80',
                'author' => 'Dunia Satwa',
                'read_time' => '3 mnt baca'
            ]
        ];

        foreach ($articles as $article) {
            $article['slug'] = \Illuminate\Support\Str::slug($article['title']);
            $article['meta_description'] = substr(strip_tags($article['content']), 0, 150) . '...';
            Article::create($article);
        }
    }
}
