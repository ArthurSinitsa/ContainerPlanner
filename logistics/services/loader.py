import pandas as pd
import gspread
import math
from django.db import transaction
from logistics.models import Product

def clean_float(value, multiplier=1.0) -> float|None:
    """Безопасно конвертирует значение в float. Если мусор - возвращает None."""
    # pd.to_numeric с errors='coerce' превратит любой нечитаемый текст в NaN
    val = pd.to_numeric(value, errors='coerce')
    if pd.isna(val) or math.isnan(val):
        return None
    return float(val) * multiplier

def clean_int(value) -> int|None:
    """Безопасно конвертирует значение в int. Если мусор - возвращает None."""
    val = clean_float(value)
    return int(val) if val is not None else None

class BaseProductLoader:
    def get_dataframe(self) -> pd.DataFrame:
        raise NotImplementedError

    def load_to_db(self):
        df = self.get_dataframe()
        df = df.dropna(subset=['ID'])

        products_to_create = []
        products_to_update = []

        existing_products = {p.product_id: p for p in Product.objects.all()}

        for index, row in df.iterrows():
            try:
                product_id = int(row['ID'])
            except ValueError:
                continue # Пропускаем строки с кривым ID

            # Безопасная обработка EAN (если пусто, то None)
            ean_val = row.get('EAN')
            if pd.isna(ean_val) or ean_val == '':
                ean_val = None
            else:
                try:
                    ean_val = int(float(ean_val))
                except ValueError:
                    ean_val = None

            raw_battery = str(row.get('Battery', '')).strip().lower()
            battery_bool = raw_battery in ['yes', 'true', '1', 'y', 'да', '+']


            product_data = {
                'sku': str(row.get('SKU', '')).strip() if pd.notna(row.get('SKU')) else None,
                'name': str(row.get('Name', '')).strip() if pd.notna(row.get('Name')) else '',
                'spec_name': str(row.get('Spec-n Name', '')).strip() if pd.notna(row.get('Spec-n Name')) else '',
                'category': str(row.get('Category', '')).strip() if pd.notna(row.get('Category')) else '',
                'ean': ean_val,
                'si_flag':str(row.get('SI', '')).strip() if pd.notna(row.get('SI')) else '',
                'eol_flag': str(row.get('EOL', '')).strip() if pd.notna(row.get('EOL')) else None,
                'kj_flag': str(row.get('k/j', '')).strip() if pd.notna(row.get('k/j')) else None,

                # Габариты продукта
                'product_length_mm': clean_float(row.get('Length Products dimension (mm)')),
                'product_width_mm': clean_float(row.get('Width Products dimension (mm)')),
                'product_height_mm': clean_float(row.get('Height Products dimension (mm)')),

                # Габариты мастербокса
                'masterbox_length_mm': clean_float(row.get('Length Masterbox dimension (m)'), multiplier=1000),
                'masterbox_width_mm': clean_float(row.get('Width Masterbox dimension (m)'), multiplier=1000),
                'masterbox_height_mm': clean_float(row.get('Height Masterbox dimension (m)'), multiplier=1000),
                'masterbox_weight_kg': clean_float(row.get('Masterbox Weight')) or 0,
                'qty_of_masterbox': clean_int(row.get('Qty of masterbox')) or 1,

                # Габариты паллеты
                'pallet_length_mm': clean_float(row.get('Length Pallet dimension (m)'), multiplier=1000),
                'pallet_width_mm': clean_float(row.get('Width Pallet dimension (m)'), multiplier=1000),
                'pallet_height_mm': clean_float(row.get('Height Pallet dimension (m)'), multiplier=1000),
                'qty_of_pallet': clean_int(row.get('Qty of pallet')) or 1,
                'pallet_weight_kg': clean_float(row.get('Pallet Weight')) or 0,

                'order_requirement': str(row.get('Order requirement', '')).strip() if pd.notna(row.get('Order requirement')) else '',
                'battery_flag': battery_bool,
            }

            if product_id in existing_products:
                prod = existing_products[product_id]
                for key, value in product_data.items():
                    setattr(prod, key, value)
                products_to_update.append(prod)
            else:
                product_data['product_id'] = product_id
                products_to_create.append(Product(**product_data))

        with transaction.atomic():
            if products_to_create:
                Product.objects.bulk_create(products_to_create)
            if products_to_update:
                fields_to_update = list(product_data.keys())
                Product.objects.bulk_update(products_to_update, fields_to_update)

        return len(products_to_create), len(products_to_update)

class GoogleSheetsLoader(BaseProductLoader):
    """Класс для загрузки данных из Google Sheets."""

    def __init__(self, credentials_file: str, spreadsheet_url: str, sheet: str|None=None):
        self.credentials_file = credentials_file
        self.spreadsheet_url = spreadsheet_url
        self.sheet = sheet

    def get_dataframe(self) -> pd.DataFrame:
        gc = gspread.service_account(filename=self.credentials_file)
        sh = gc.open_by_url(self.spreadsheet_url)
        if self.sheet:
            worksheet = sh.worksheet(self.sheet)
        else:
            worksheet = sh.sheet1

        data = worksheet.get_all_records()
        return pd.DataFrame(data)


class FileLoader(BaseProductLoader):
    """Класс для загрузки данных из локального .xlsx или .csv файла."""

    def __init__(self, file_obj):
        self.file = file_obj
        self.filename = file_obj.name.lower()

    def get_dataframe(self) -> pd.DataFrame:
        if self.filename.endswith('.csv'):
            return pd.read_csv(self.file, sep=None, engine='python')
        elif self.filename.endswith(('.xls', '.xlsx')):
            return pd.read_excel(self.file, engine='openpyxl')
        else:
            raise ValueError("Формат файла не поддерживается. Загрузите .csv или .xlsx")