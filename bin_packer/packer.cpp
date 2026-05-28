#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <vector>
#include <string>
#include <algorithm>
#include <limits>

namespace py = pybind11;

// ─── Структуры данных ──────────────────────────────────────────────────────

struct Item {
    int product_id;
    std::string item_type;
    std::string product_name;
    int qty_per_unit;
    int w, l, h;       // ширина, длина, высота (мм). h ВСЕГДА вертикаль — не трогаем.
    float weight;
    std::string group_key;
    bool is_dangerous  = false;
    bool battery_flag  = false;

    int x = 0, y = 0, z = 0;
    bool packed = false;
};

struct Point3D {
    int x, y, z;
    bool operator==(const Point3D& o) const {
        return x == o.x && y == o.y && z == o.z;
    }
    bool operator<(const Point3D& o) const {
        if (x != o.x) return x < o.x;
        if (y != o.y) return y < o.y;
        return z < o.z;
    }
    bool operator>(const Point3D& o) const {
            if (x != o.x) return x > o.x;
            if (y != o.y) return y > o.y;
            return z > o.z;
        }
};

struct ContainerResult {
    int container_index;
    std::vector<Item> packed_items;
    std::vector<Item> unpacked_items;
    float total_weight = 0.0f;
};

// ─── Ядро алгоритма: BinPacker ─────────────────────────────────────────────

class BinPacker {
    int bin_w, bin_l, bin_h;
    float max_weight;

    std::vector<Item> placed;
    std::vector<Point3D> extreme_points;
    float current_weight = 0.0f;

    // Убирает дубликаты и точки за границей контейнера
    void normalize_extreme_points() {
        // Фильтруем точки вне контейнера
        extreme_points.erase(
            std::remove_if(extreme_points.begin(), extreme_points.end(),
                [&](const Point3D& ep) {
                    return ep.x >= bin_w || ep.y >= bin_h || ep.z >= bin_l;
                }),
            extreme_points.end()
        );
        // Сортируем и удаляем дубликаты
        std::sort(extreme_points.begin(), extreme_points.end());
        extreme_points.erase(
            std::unique(extreme_points.begin(), extreme_points.end()),
            extreme_points.end()
        );
    }

public:
    BinPacker(int w, int l, int h, float mw)
        : bin_w(w), bin_l(l), bin_h(h), max_weight(mw) {
        extreme_points.push_back({0, 0, 0});
    }

    bool can_place(const Item& item, int px, int py, int pz) const {
        if (px + item.w > bin_w) return false;
        if (py + item.h > bin_h) return false;
        if (pz + item.l > bin_l) return false;
        if (current_weight + item.weight > max_weight) return false;

        for (const auto& p : placed) {
            bool ox = px < p.x + p.w && px + item.w > p.x;
            bool oy = py < p.y + p.h && py + item.h > p.y;
            bool oz = pz < p.z + p.l && pz + item.l > p.z;
            if (ox && oy && oz) return false;
        }
        return true;
    }

    // Gravity: опускает предмет вниз до ближайшей опоры
    int gravity_y(const Item& item, int px, int pz) const {
        int best_y = 0;
        for (const auto& p : placed) {
            bool ox = px < p.x + p.w && px + item.w > p.x;
            bool oz = pz < p.z + p.l && pz + item.l > p.z;
            if (ox && oz) best_y = std::max(best_y, p.y + p.h);
        }
        return best_y;
    }

    void update_extreme_points(const Item& item, int px, int py, int pz) {
        extreme_points.push_back({px + item.w, py,         pz        });
        extreme_points.push_back({px,           py + item.h, pz        });
        extreme_points.push_back({px,           py,         pz + item.l});

        // Убираем точки, поглощённые новым предметом
        extreme_points.erase(
            std::remove_if(extreme_points.begin(), extreme_points.end(),
                [&](const Point3D& ep) {
                    return ep.x >= px && ep.x < px + item.w &&
                           ep.y >= py && ep.y < py + item.h &&
                           ep.z >= pz && ep.z < pz + item.l;
                }),
            extreme_points.end()
        );

        normalize_extreme_points();
    }

    // Пробует уложить предмет в двух ориентациях по горизонтали (swap w <-> l).
    // h (высота) НИКОГДА не меняется — верх всегда вверху.
    bool try_pack(Item& item) {
        // Две горизонтальные ориентации: (w, l) и (l, w)
        // Если w == l — одна ориентация
        std::vector<std::pair<int,int>> orientations = {{item.w, item.l}};
        if (item.w != item.l) orientations.push_back({item.l, item.w});

        int best_x = -1;
        int best_y = std::numeric_limits<int>::max();
        int best_z = -1;
        int best_w = item.w;
        int best_l = item.l;

        for (auto [ow, ol] : orientations) {
            Item probe = item;
            probe.w = ow;
            probe.l = ol;

            for (const auto& ep : extreme_points) {
                int py = gravity_y(probe, ep.x, ep.z);
                if (!can_place(probe, ep.x, py, ep.z)) continue;

                // Критерий: ниже (y) → глубже внутрь (z) → левее (x)
                bool better = (py < best_y)
                    || (py == best_y && ep.z < best_z)
                    || (py == best_y && ep.z == best_z && ep.x < best_x);

                if (better) {
                    best_y = py;
                    best_x = ep.x;
                    best_z = ep.z;
                    best_w = ow;
                    best_l = ol;
                }
            }
        }

        if (best_x == -1) return false;

        item.w = best_w;
        item.l = best_l;
        item.x = best_x;
        item.y = best_y;
        item.z = best_z;
        item.packed = true;
        current_weight += item.weight;
        update_extreme_points(item, best_x, best_y, best_z);
        placed.push_back(item);
        return true;
    }

    const std::vector<Item>& get_placed() const { return placed; }
    float get_weight() const { return current_weight; }
};

// ─── Вспомогательная функция: один проход упаковки ─────────────────────────

std::vector<ContainerResult> run_packing(
    std::vector<Item> items,
    int bin_w, int bin_l, int bin_h,
    float max_weight
) {
    std::vector<ContainerResult> results;
    int container_index = 1;

    while (!items.empty()) {
        BinPacker packer(bin_w, bin_l, bin_h, max_weight);
        ContainerResult result;
        result.container_index = container_index;

        std::vector<Item> remaining;
        for (auto& item : items) {
            if (!packer.try_pack(item)) remaining.push_back(item);
        }

        if (packer.get_placed().empty()) {
            result.unpacked_items = remaining;
            results.push_back(result);
            break;
        }

        result.packed_items  = packer.get_placed();
        result.total_weight  = packer.get_weight();
        results.push_back(result);

        items = remaining;
        container_index++;
    }

    return results;
}

// ─── Главная функция с Lookahead-сортировкой ──────────────────────────────

std::vector<ContainerResult> pack_items(
    std::vector<Item> items,
    int bin_w, int bin_l, int bin_h,
    float max_weight
) {
    // Эвристика 1: по убыванию объёма
    auto by_volume = items;
    std::sort(by_volume.begin(), by_volume.end(), [](const Item& a, const Item& b) {
        return (long long)a.w * a.l * a.h > (long long)b.w * b.l * b.h;
    });

    // Эвристика 2: по убыванию максимального габарита (длинные предметы вперёд)
    auto by_max_dim = items;
    std::sort(by_max_dim.begin(), by_max_dim.end(), [](const Item& a, const Item& b) {
        return std::max({a.w, a.l, a.h}) > std::max({b.w, b.l, b.h});
    });

    // Эвристика 3: по убыванию площади основания (для плоских грузов)
    auto by_area = items;
    std::sort(by_area.begin(), by_area.end(), [](const Item& a, const Item& b) {
        return a.w * a.l > b.w * b.l;
    });

    auto r1 = run_packing(by_volume,  bin_w, bin_l, bin_h, max_weight);
    auto r2 = run_packing(by_max_dim, bin_w, bin_l, bin_h, max_weight);
    auto r3 = run_packing(by_area,    bin_w, bin_l, bin_h, max_weight);

    // Выбираем результат с наименьшим количеством контейнеров.
    // При равенстве — с максимально заполненным первым контейнером.
    auto score = [](const std::vector<ContainerResult>& r) -> std::pair<int, float> {
        float first_vol = r.empty() ? 0.f : r[0].total_weight; // proxy: вес как заполненность
        return {(int)r.size(), -first_vol};
    };

    auto* best = &r1;
    if (score(r2) < score(*best)) best = &r2;
    if (score(r3) < score(*best)) best = &r3;

    // Переиндексируем контейнеры с 1
    int idx = 1;
    for (auto& res : *best) res.container_index = idx++;

    return *best;
}

// ─── Pybind11 биндинги ─────────────────────────────────────────────────────

PYBIND11_MODULE(fast_bin_packer, m) {
    m.doc() = "Gravity-aware 3D bin packer: Extreme Points + rotations + lookahead";

    py::class_<Item>(m, "Item")
        .def(py::init<>())
        .def_readwrite("product_id",   &Item::product_id)
        .def_readwrite("product_name", &Item::product_name)
        .def_readwrite("qty_per_unit", &Item::qty_per_unit)
        .def_readwrite("item_type",    &Item::item_type)
        .def_readwrite("w",            &Item::w)
        .def_readwrite("l",            &Item::l)
        .def_readwrite("h",            &Item::h)
        .def_readwrite("weight",       &Item::weight)
        .def_readwrite("group_key",    &Item::group_key)
        .def_readwrite("is_dangerous", &Item::is_dangerous)
        .def_readwrite("battery_flag", &Item::battery_flag)
        .def_readwrite("x",            &Item::x)
        .def_readwrite("y",            &Item::y)
        .def_readwrite("z",            &Item::z)
        .def_readwrite("packed",       &Item::packed);

    py::class_<ContainerResult>(m, "ContainerResult")
        .def_readwrite("container_index",  &ContainerResult::container_index)
        .def_readwrite("packed_items",     &ContainerResult::packed_items)
        .def_readwrite("unpacked_items",   &ContainerResult::unpacked_items)
        .def_readwrite("total_weight",     &ContainerResult::total_weight);

    m.def("pack_items", &pack_items,
          py::arg("items"),
          py::arg("bin_w"), py::arg("bin_l"), py::arg("bin_h"),
          py::arg("max_weight"));
}
