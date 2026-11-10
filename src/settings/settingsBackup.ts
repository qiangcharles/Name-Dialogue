import type { DataAdapter } from "obsidian"

export type BackupAdapter = Pick<DataAdapter, "exists" | "readBinary" | "copy" | "remove">

const backupName = /^data\.json\.backup\(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:-\d{6})?\)$/

export function isBackupName(value: string): boolean {
	return backupName.test(value)
}

export function equalBytes(first: ArrayBuffer, second: ArrayBuffer): boolean {
	const firstBytes = new Uint8Array(first)
	const secondBytes = new Uint8Array(second)
	return firstBytes.length === secondBytes.length
		&& firstBytes.every((value, index) => value === secondBytes[index])
}

export async function createBackup(
	adapter: BackupAdapter,
	directory: string,
	dataPath: string,
	snapshot: ArrayBuffer,
	now: Date,
): Promise<string> {
	const timestamp = now.toISOString().replace(/[:.]/g, "-")
	for (let attempt = 0; attempt <= 3; attempt++) {
		const suffix = attempt === 0 ? "" : `-${String(attempt).padStart(6, "0")}`
		const backupPath = `${directory}/data.json.backup(${timestamp}${suffix})`
		if (await adapter.exists(backupPath)) continue
		await adapter.copy(dataPath, backupPath)
		const backup = await adapter.readBinary(backupPath)
		if (!equalBytes(snapshot, backup)) {
			throw new Error(`Settings backup verification failed: ${backupPath}`)
		}
		return backupPath
	}
	throw new Error("Unable to create a uniquely named settings backup.")
}

export async function deletePreviousBackup(
	adapter: BackupAdapter,
	directory: string,
	previousName: string | undefined,
	latestPath: string,
	expected: ArrayBuffer,
	confirm: (name: string) => Promise<boolean>,
): Promise<void> {
	if (!previousName || !isBackupName(previousName)) return
	const previousPath = `${directory}/${previousName}`
	if (previousPath === latestPath || !(await adapter.exists(previousPath))) return
	const previous = await adapter.readBinary(previousPath)
	if (!(await confirm(previousName))) return
	if (!equalBytes(expected, await adapter.readBinary(latestPath))) {
		throw new Error("The new settings backup changed; the previous backup was kept.")
	}
	if (!equalBytes(previous, await adapter.readBinary(previousPath))) {
		throw new Error("The previous settings backup changed; it was kept.")
	}
	await adapter.remove(previousPath)
}
