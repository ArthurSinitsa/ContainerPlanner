import sys
from setuptools import setup
from pybind11.setup_helpers import Pybind11Extension, build_ext

extra_args = ['-O3'] if sys.platform != 'win32' else ['/O2']

ext_modules = [
    Pybind11Extension(
        'fast_bin_packer',
        ['packer.cpp'],
        cxx_std=17,
        extra_compile_args=extra_args,
    ),
]

setup(
    name='fast_packer',
    version='0.1.0',
    description='Gravity-aware 3D bin packer',
    ext_modules=ext_modules,
    cmdclass={'build_ext': build_ext},
    zip_safe=False,
)