export function fileTimeToDate(fileTime?: string | number) :Date | null {
    if (!fileTime) return null;

    const value = BigInt(fileTime);

    if (value === 0n) return null;

    // Windows FILETIME starts Jan 1, 1601
    const unixTime = Number((value - 116444736000000000n) / 10000000n);

    return new Date(unixTime * 1000);
}