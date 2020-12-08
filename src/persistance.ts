import { join } from "path";
import { existsSync, mkdirSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "fs";

// TODO: parameter types

export function createFile(folder: any, name: string): boolean {
	const filePath = join(folder.path, name);
	if (existsSync(filePath) && statSync(filePath).isFile())
		return false;

	const newFile = {
		name: name,
		path: filePath,
		type: 2,
		lastModified: 123,
	};
	folder.files.push(newFile);
	writeFileSync(filePath, "");

	//saveTable(table)
	return true;
}

export function createFolder(folder: any, name: any): boolean {
	const filePath = join(folder.path, name);
	if (
		existsSync(filePath) &&
		statSync(filePath).isDirectory()
	)
		return false;

	const newFolder = {
		name: name,
		subFolders: [],
		files: [],
		path: filePath,
		type: 1,
		lastModified: 123,
	};
	folder.subFolders.push(newFolder);
	mkdirSync(filePath);
	return true;
}

export function deleteFile(parent: any, f: any): boolean {
	if (!f) return false;
	unlinkSync(f.path);
	parent.files.splice(parent.subFolders.indexOf(f));
	return true;
}

export function deleteFolder(parent: any, f: any): boolean {
	if (!f) return false;
	rmdirSync(f.path, { recursive: true });
	parent.subFolders.splice(parent.subFolders.indexOf(f));
	return true;
}