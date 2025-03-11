import {uniqueNamesGenerator, animals, names} from 'unique-names-generator';

export function generateRandomContact() {
  const randomName = uniqueNamesGenerator({
    dictionaries: [names, animals],
    separator: '',
  }); // big_red_donkey

  return {uniqueName: randomName + Math.ceil(Math.random() * 99)};
}
