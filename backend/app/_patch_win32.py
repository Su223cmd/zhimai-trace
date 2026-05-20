import os
import platform
import collections

_uname_result = collections.namedtuple("uname_result", "system node release version machine processor")

_cached_uname = _uname_result(
    system="Windows",
    node=os.environ.get("COMPUTERNAME", "PC"),
    release="10",
    version="10.0.19045",
    machine=os.environ.get("PROCESSOR_ARCHITECTURE", "") or "AMD64",
    processor="Intel64 Family 6 Model 165 Stepping 5, GenuineIntel",
)

platform.uname = lambda: _cached_uname

if hasattr(platform, "_get_machine_win32"):
    platform._get_machine_win32 = lambda: _cached_uname.machine